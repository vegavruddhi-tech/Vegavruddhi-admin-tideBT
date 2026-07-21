/**
 * Pre-warm cache for all months locally — bypasses Vercel 10s timeout
 * Runs the heavy all-details computation directly against MongoDB and stores result in TideBT_SummaryCache
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEAR = '2026';

const MONTH_ABBR = {
  'JANUARY':'JAN','FEBRUARY':'FEB','MARCH':'MAR','APRIL':'APR',
  'MAY':'MAY','JUNE':'JUN','JULY':'JUL','AUGUST':'AUG',
  'SEPTEMBER':'SEP','OCTOBER':'OCT','NOVEMBER':'NOV','DECEMBER':'DEC'
};

async function findBTCollection(db, monthName, yearStr) {
  if (!monthName) return null;
  const all = (await db.listCollections().toArray()).map(c => c.name);
  const mu = monthName.toUpperCase();
  const abbr = MONTH_ABBR[mu] || mu;
  const sy = yearStr ? yearStr.slice(-2) : null;
  // Prefer BT_TL_CONNECT* collections — sort to put uppercase/space-separated ones first
  const btCols = all.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'))
    .sort((a, b) => b.length - a.length); // longer names (with month) first
  const tlCols = all.filter(c => c.toUpperCase().includes('TL_CONNECT') && !c.toUpperCase().startsWith('BT_TL_CONNECT'));
  const candidates = [...btCols, ...tlCols];
  const mm = cu => cu.includes(mu) || cu.includes(abbr);
  if (yearStr) {
    const m = candidates.find(c => { const cu = c.toUpperCase(); return mm(cu) && (cu.includes(yearStr) || (sy && cu.includes(sy))); });
    if (m) return m;
  }
  // No-year fallback: prefer BT_TL_CONNECT over tl_connect
  const btMatch = btCols.find(c => mm(c.toUpperCase()));
  if (btMatch) return btMatch;
  return tlCols.find(c => mm(c.toUpperCase())) || null;
}

async function computeAndCacheMonth(db, month, year) {
  const cacheKey = `FSE_ALL_DETAILS:${month.toUpperCase()}:${year}`;
  
  // Check if already cached
  const existing = await db.collection('TideBT_SummaryCache').findOne({ cacheKey });
  if (existing) {
    console.log(`  ⚡ Already cached: ${month} ${year}`);
    return;
  }

  const btCollectionName = await findBTCollection(db, month, year);
  if (!btCollectionName) {
    console.log(`  ⚠️ No BT collection found for ${month} ${year} — skipping`);
    return;
  }

  const masterDocs = await db.collection('bt_master').find(
    {}, { projection: { merchantNumber: 1, merchantName: 1, fseName: 1, tl: 1, _id: 0 } }
  ).toArray();

  const merchantNums = masterDocs.map(m => (m.merchantNumber||'').trim()).filter(Boolean);

  const merchantMap = {};
  masterDocs.forEach(m => {
    const key = (m.merchantNumber||'').trim();
    if (!key) return;
    merchantMap[key] = {
      merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
      fseName: (m.fseName||'').trim(), tl: (m.tl||'').trim(),
      tlName: (m.tl||'').trim()||'–',
      onboardingStatus: 'Pending', lastActivity: null,
      stage3: 0, stage3Gap: 0, passLive: '–', rewardPassPro: '–',
      upiTxnCount: 0, btVerified: false, merchantCategory: '–', upiAmount: 0
    };
  });

  // Enrich from form responses
  const formDocs = await db.collection('TideBT Form Responses').find(
    { merchantNumber: { $in: merchantNums } },
    { projection: { merchantNumber: 1, createdAt: 1, merchantOpinion: 1, onboardingStatus: 1, merchantCategory: 1, _id: 0 } }
  ).sort({ createdAt: -1 }).toArray();

  formDocs.forEach(f => {
    const m = merchantMap[(f.merchantNumber||'').trim()];
    if (!m) return;
    const d = f.createdAt ? new Date(f.createdAt) : null;
    if (d && !isNaN(d) && (!m.lastActivity || d > new Date(m.lastActivity))) {
      m.lastActivity = f.createdAt;
      m.onboardingStatus = (f.onboardingStatus || f.merchantOpinion || '').trim() || 'Pending';
      m.merchantCategory = (f.merchantCategory || '').trim();
    }
  });

  // Enrich from BT collection
  if (btCollectionName) {
    const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
    const getStr  = (r,keys) => { for (const k of keys) { if (r[k]!==undefined&&r[k]!==null) return String(r[k]).trim(); } return '–'; };
    const btDocs = await db.collection(btCollectionName).find(
      { merchantNumber: { $in: merchantNums } },
      { projection: { merchantNumber:1, stage3:1, stage3Gap:1, passLive:1, pass_live:1, Pass_Live:1, rewardPassPro:1, reward_pass_pro:1, priorityPassPro:1, upiTxnCount:1, upi_txn_count:1, withdrawAmount:1, _id:0 } }
    ).toArray();
    btDocs.forEach(r => {
      const m = merchantMap[(r.merchantNumber||'').trim()];
      if (!m) return;
      m.stage3      = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
      m.stage3Gap   = parseNum(r.stage3Gap || r['Stage-3_GAP']);
      m.passLive    = getStr(r, ['passLive','pass_live','Pass_Live']);
      m.rewardPassPro = getStr(r, ['rewardPassPro','reward_pass_pro','priorityPassPro']);
      m.upiTxnCount = parseNum(r.upiTxnCount || r.upi_txn_count);
      m.upiAmount   = parseNum(r.withdrawAmount || r.UPI_Amount || r.upiAmount);
      const isLive = m.passLive.toLowerCase()==='live';
      const isAct  = m.rewardPassPro.toLowerCase()==='active';
      m.btVerified = isLive || isAct || m.stage3 > 0;
      if (isLive || isAct) m.onboardingStatus = 'Onboarded';
      else if (m.stage3 > 0) m.onboardingStatus = 'BT Active';
    });
  }

  const merchants = Object.values(merchantMap);
  const result = { success: true, merchants, btCollection: btCollectionName };

  await db.collection('TideBT_SummaryCache').updateOne(
    { cacheKey },
    { $set: { cacheKey, data: result, updatedAt: new Date() } },
    { upsert: true }
  );

  const totalBT = merchants.reduce((s, m) => s + (m.stage3||0), 0);
  console.log(`  ✅ Cached ${month} ${year}: ${merchants.length} merchants, ₹${totalBT.toLocaleString()} BT`);
}

async function run() {
  console.log('🔥 Pre-warming cache for all months...\n');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  for (const month of MONTHS) {
    console.log(`Processing ${month} ${YEAR}...`);
    try {
      await computeAndCacheMonth(db, month, YEAR);
    } catch (e) {
      console.log(`  ❌ Error for ${month}: ${e.message}`);
    }
  }

  await mongoose.connection.close();
  console.log('\n✅ All months pre-warmed! Admin panel will now load instantly.');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
