const express = require('express');
const router = express.Router();
const { cacheGet, cacheSet, cacheKey, cacheInvalidate } = require('../utils/cache');

// Helper: find BT_TL_CONNECT collection — hardcoded canonical format "BT_TL_CONNECT [MONTH]"
// e.g. selectedMonth="July" → looks for "BT_TL_CONNECT JULY" first.
// Falls back to abbreviation "BT_TL_CONNECT JUL" and then any matching collection.
function findBTCollection(allCollections, selectedMonth, selectedYear) {
  if (!selectedMonth) return null;
  const mu = selectedMonth.toUpperCase(); // e.g. "JULY"
  const ABBR = { 'JANUARY':'JAN','FEBRUARY':'FEB','MARCH':'MAR','APRIL':'APR','MAY':'MAY','JUNE':'JUN','JULY':'JUL','AUGUST':'AUG','SEPTEMBER':'SEP','OCTOBER':'OCT','NOVEMBER':'NOV','DECEMBER':'DEC' };
  const abbr = ABBR[mu] || mu; // e.g. "JUL"

  // Try canonical name first: "BT_TL_CONNECT JULY"
  const canonical = `BT_TL_CONNECT ${mu}`;
  if (allCollections.includes(canonical)) return canonical;

  // Try abbreviation: "BT_TL_CONNECT JUL"
  const canonicalAbbr = `BT_TL_CONNECT ${abbr}`;
  if (allCollections.includes(canonicalAbbr)) return canonicalAbbr;

  // Fallback: any collection starting with BT_TL_CONNECT that contains the month name/abbr
  const btCols = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
  const matchesMonth = (cu) => cu.includes(mu) || cu.includes(abbr);
  return btCols.find(c => matchesMonth(c.toUpperCase())) || null;
}

// GET /api/fse - Get all FSEs with Tide BT access
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    
    console.log('🔍 Fetching FSEs from TideBT_Access...');
    
    // Get all unique FSEs from TideBT_Access collection (fseName field)
    const accessList = await db.collection('TideBT_Access').find({ 
      hasTideBTAccess: true 
    }).toArray();
    
    // Get employee details from Employees collection
    const employees = await db.collection('Employees').find({}).toArray();
    
    // Build FSE list with details — matching by email or fseName
    const fseList = accessList.map(accessRecord => {
      const emp = employees.find(e => 
        (accessRecord.fseEmail && e.newJoinerEmailId?.toLowerCase().trim() === accessRecord.fseEmail?.toLowerCase().trim()) ||
        (accessRecord.fseName && e.newJoinerName?.toLowerCase().trim() === accessRecord.fseName?.toLowerCase().trim())
      );
      
      return {
        name: accessRecord.fseName || emp?.newJoinerName,
        phone: emp?.newJoinerPhone || '',
        email: accessRecord.fseEmail || emp?.newJoinerEmailId || '',
        reportingManager: accessRecord.tlName || emp?.reportingManager || '',
        status: 'active',
        createdAt: accessRecord.createdAt || null
      };
    });
    
    res.json({ success: true, fses: fseList, total: fseList.length });
  } catch (error) {
    console.error('❌ Error fetching FSEs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fse/merchants/all - FSE summary + BT metrics (fast, no merchant details)
router.get('/merchants/all', async (req, res) => {
  try {
    const db = req.db;
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Cache check
    const ck = cacheKey('FSE_MERCHANTS_ALL', selectedMonth, selectedYear);
    const cached = await cacheGet(db, ck);
    if (cached) {
      console.log(`[Cache HIT] ${ck}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] ${ck}`);

    // Step 1: FSE names + TL mapping
    const accessList = await db.collection('TideBT_Access').find(
      { hasTideBTAccess: true },
      { projection: { fseName: 1, tlName: 1, _id: 0 } }
    ).toArray();
    const fseNames = [...new Set(accessList.map(a => a.fseName).filter(Boolean))];
    if (fseNames.length === 0) return res.json({ success: true, data: [], btCollection: null });

    const tlMap = {};
    accessList.forEach(a => { if (a.fseName) tlMap[a.fseName] = a.tlName || '–'; });

    // Step 2: BT collection — use helper that prefers canonical uppercase+space format
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCollectionName = findBTCollection(allCollections, selectedMonth, selectedYear);

    // Step 3: bt_master — count merchants per FSE + get all numbers
    const masterDocs = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }
    ).toArray();

    const fseMerchantNums = {};
    fseNames.forEach(n => { fseMerchantNums[n] = []; });
    masterDocs.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      if (!num) return;
      const matchedFSE = fseNames.find(n => new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i').test(m.fseName || ''));
      if (matchedFSE) fseMerchantNums[matchedFSE].push(num);
    });

    const allNums = [...new Set(masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean))];

    // Step 4: BT metrics from BT_TL_CONNECT — aggregate by merchantNumber
    const btMetrics = {}; // fseName → {totalBT, btDone, rpDone, passLive, yesterdayBT}
    if (btCollectionName && allNums.length > 0) {
      const btDocs = await db.collection(btCollectionName).find(
        { merchantNumber: { $in: allNums } },
        { projection: { merchantNumber: 1, stage3: 1, rewardPassPro: 1, passLive: 1, priorityPassPro: 1, yesterdaysStage3: 1, yesterday_s_stage_3: 1, _id: 0 } }
      ).toArray();

      // Build num→fse map
      const numToFse = {};
      masterDocs.forEach(m => { numToFse[(m.merchantNumber||'').trim()] = m.fseName; });

      btDocs.forEach(r => {
        const num = (r.merchantNumber || '').trim();
        const rawFse = numToFse[num];
        const fseName = fseNames.find(n => new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i').test(rawFse || ''));
        if (!fseName) return;
        if (!btMetrics[fseName]) btMetrics[fseName] = { totalBT: 0, btDone: 0, rpDone: 0, passLive: 0, yesterdayBT: 0 };
        const s3  = parseFloat(String(r.stage3 || '0').replace(/,/g,'')) || 0;
        const y3  = parseFloat(String(r.yesterdaysStage3 || r.yesterday_s_stage_3 || r["Yesterday's_Stage-3"] || '0').replace(/,/g,'')) || 0;
        const rp  = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active';
        const pl  = (r.passLive || '').toLowerCase() === 'live';
        btMetrics[fseName].totalBT     += s3;
        btMetrics[fseName].yesterdayBT += y3;
        if (s3 > 0) btMetrics[fseName].btDone++;
        if (rp) btMetrics[fseName].rpDone++;
        if (pl) btMetrics[fseName].passLive++;
      });
    }

    const collectionMonth = btCollectionName ? (() => { const p = btCollectionName.split(' '); const m = p[p.length-1]; return m ? m.charAt(0)+m.slice(1).toLowerCase() : null; })() : null;

    // Step 5: Build summary per FSE (no merchant details)
    const data = fseNames.map(fseName => {
      const total = (fseMerchantNums[fseName] || []).length;
      const bm = btMetrics[fseName] || { totalBT: 0, btDone: 0, rpDone: 0, passLive: 0, yesterdayBT: 0 };
      return {
        fseName,
        tlName: tlMap[fseName] || '–',
        metrics: {
          total,
          btDone:      bm.btDone,
          rpDone:      bm.rpDone,
          passLive:    bm.passLive,
          pending:     total - bm.passLive,
          totalBT:     Math.round(bm.totalBT),
          yesterdayBT: Math.round(bm.yesterdayBT || 0),
          verified:    bm.btDone,
          onboarded:   bm.passLive,
        }
      };
    }).filter(d => d.metrics.total > 0);

    const result = { success: true, data, btCollection: btCollectionName, collectionMonth };
    await cacheSet(db, ck, result, 0); // permanent — busted on write
    res.json(result);
  } catch (err) {
    console.error('FSE merchants summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/fse/merchants/all-details - ALL FSEs full merchant data in ONE call (for KPI drill-down)
router.get('/merchants/all-details', async (req, res) => {
  try {
    const db = req.db;
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Cache check
    const ck = cacheKey('FSE_ALL_DETAILS', selectedMonth, selectedYear);
    const cached = await cacheGet(db, ck);
    if (cached) {
      console.log(`[Cache HIT] ${ck}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] ${ck}`);

    // BT collection — use helper that prefers canonical uppercase+space format
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCollectionName = findBTCollection(allCollections, selectedMonth, selectedYear);

    // Get ALL merchants from bt_master in ONE query
    const masterDocs = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, merchantName: 1, fseName: 1, tl: 1, _id: 0 } }
    ).toArray();

    const merchantNums = masterDocs.map(m => (m.merchantNumber||'').trim()).filter(Boolean);

    // Build merchant map
    const merchantMap = {};
    masterDocs.forEach(m => {
      const key = (m.merchantNumber||'').trim();
      if (!key) return;
      merchantMap[key] = {
        merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
        fseName: (m.fseName||'').trim(), tl: (m.tl||'').trim(),
        tlName: (m.tl||'').trim() || '–',  // explicit tlName field for TL Overview
        onboardingStatus: 'Pending', lastActivity: null,
        stage3: 0, stage3Gap: 0, passLive: '–', rewardPassPro: '–',
        upiTxnCount: 0, btVerified: false, merchantCategory: '–',
        yesterdaysStage3: 0
      };
    });

    // Enrich from TideBT Form Responses (latest per merchant)
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

    // Enrich from BT_TL_CONNECT
    if (btCollectionName) {
      const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
      const getStr = (r, keys) => { for (const k of keys) { if (r[k]!==undefined&&r[k]!==null) return String(r[k]).trim(); } return '–'; };
      // Fetch ALL docs from BT collection — not restricted to bt_master numbers
      // This ensures merchants in the sheet but missing from bt_master are still counted
      const btDocs = await db.collection(btCollectionName).find(
        {},
        { projection: { merchantNumber: 1, stage3: 1, stage3Gap: 1, passLive: 1, pass_live: 1, Pass_Live: 1, rewardPassPro: 1, reward_pass_pro: 1, priorityPassPro: 1, upiTxnCount: 1, upi_txn_count: 1, Upi_Txn_Count: 1, withdrawAmount: 1, UPI_Amount: 1, upiAmount: 1, lead: 1, Lead: 1, teamLeadName: 1, yesterdaysStage3: 1, yesterday_s_stage_3: 1, _id: 0 } }
      ).toArray();
      btDocs.forEach(r => {
        const num = (r.merchantNumber || '').trim();
        if (!num) return;
        // Add to merchantMap if not already there (merchant in sheet but not in bt_master)
        if (!merchantMap[num]) {
          merchantMap[num] = {
            merchantNumber: num, merchantName: '–',
            fseName: (r.lead || r.Lead || '').trim(),
            tl: (r.teamLeadName || '').trim(),
            tlName: (r.teamLeadName || '').trim() || '–',
            onboardingStatus: 'Pending', lastActivity: null,
            stage3: 0, stage3Gap: 0, passLive: '–', rewardPassPro: '–',
            upiTxnCount: 0, btVerified: false, merchantCategory: '–',
            yesterdaysStage3: 0
          };
        }
        const m = merchantMap[num];
        // Take the latest value (overwrite) — duplicate rows have same BT amount, not split
        m.stage3    = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
        m.stage3Gap = parseNum(r.stage3Gap || r['Stage-3_GAP']);
        m.yesterdaysStage3 = parseNum(r.yesterdaysStage3 || r.yesterday_s_stage_3 || r["Yesterday's_Stage-3"] || r["Yesterday's_Stage_3"] || 0);
        m.passLive  = getStr(r, ['passLive','pass_live','Pass_Live']);
        m.rewardPassPro = getStr(r, ['rewardPassPro','reward_pass_pro','priorityPassPro']);
        m.upiTxnCount = parseNum(r.upiTxnCount || r.upi_txn_count || r.Upi_Txn_Count);
        m.upiAmount   = parseNum(r.withdrawAmount || r.UPI_Amount || r.upiAmount);
        const isLive = m.passLive.toLowerCase()==='live';
        const isActive = m.rewardPassPro.toLowerCase()==='active';
        m.btVerified = isLive || isActive || m.stage3 > 0;
        if (isLive || isActive) m.onboardingStatus = 'Onboarded';
        else if (m.stage3 > 0) m.onboardingStatus = 'BT Active';
      });
    }

    const merchants = Object.values(merchantMap).map(m => ({
      merchantNumber: m.merchantNumber,
      merchantName:   m.merchantName,
      fseName:        m.fseName,
      tl:             m.tl,
      tlName:         m.tlName || m.tl || '–',
      onboardingStatus: m.onboardingStatus,
      lastActivity:   m.lastActivity,
      stage3:         m.stage3,
      stage3Gap:      m.stage3Gap,
      yesterdaysStage3: m.yesterdaysStage3 || 0,
      passLive:       m.passLive,
      rewardPassPro:  m.rewardPassPro,
      upiTxnCount:    m.upiTxnCount,
      upiAmount:      m.upiAmount || 0,
      btVerified:     m.btVerified,
      merchantCategory: m.merchantCategory
    }));
    const result = { success: true, merchants, btCollection: btCollectionName };
    await cacheSet(db, ck, result, 0); // permanent — busted on write
    res.json(result);
  } catch (err) {
    console.error('FSE all-details error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/fse/merchants/:fseName - Get merchants for ONE FSE (called on expand)
router.get('/merchants/:fseName', async (req, res) => {
  try {
    const db = req.db;
    const fseName = decodeURIComponent(req.params.fseName);
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Cache check — per FSE per month
    const ck = cacheKey('FSE_MERCHANTS', fseName, selectedMonth, selectedYear);
    const cached = await cacheGet(db, ck);
    if (cached) {
      console.log(`[Cache HIT] ${ck}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] ${ck}`);

    // BT collection — use helper that prefers canonical uppercase+space format
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCollectionName = findBTCollection(allCollections, selectedMonth, selectedYear);

    // Get merchants for this FSE from bt_master
    const masterDocs = await db.collection('bt_master').find(
      { fseName: { $regex: new RegExp(`^\\s*${escape(fseName)}\\s*\\d*\\s*$`, 'i') } },
      { projection: { merchantNumber: 1, merchantName: 1, fseName: 1, tl: 1, _id: 0 } }
    ).toArray();

    if (masterDocs.length === 0) return res.json({ success: true, merchants: [] });

    const merchantNums = masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean);

    // Build merchant map
    const merchantMap = {};
    masterDocs.forEach(m => {
      const key = (m.merchantNumber || '').trim();
      if (!key) return;
      merchantMap[key] = {
        merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
        tl: (m.tl||'').trim(), fseName,
        onboardingStatus: 'Pending', submissionDate: null, lastActivity: null,
        btVerified: false, stage3: 0, stage3Gap: 0, passLive: '–',
        rewardPassPro: '–', upiActive: '–', upiTxnCount: 0, upiAmount: 0,
        priorityPassStatus: '–', msmegstStatus: '–', insuranceStatus: '–',
        rewardsPassProActiveDate: '–', latestOpinion: '–', merchantCategory: '–', visitCount: 0
      };
    });

    // Enrich from TideBT Form Responses — only latest per merchant
    const formDocs = await db.collection('TideBT Form Responses').find(
      { merchantNumber: { $in: merchantNums } },
      { projection: { merchantNumber: 1, createdAt: 1, onboardingStatus: 1, merchantOpinion: 1, merchantCategory: 1, _id: 0 } }
    ).sort({ createdAt: -1 }).toArray();

    formDocs.forEach(f => {
      const m = merchantMap[(f.merchantNumber||'').trim()];
      if (!m) return;
      const d = f.createdAt ? new Date(f.createdAt) : null;
      if (d && !isNaN(d)) {
        if (!m.submissionDate || d < new Date(m.submissionDate)) m.submissionDate = f.createdAt;
        if (!m.lastActivity  || d > new Date(m.lastActivity)) {
          m.lastActivity = f.createdAt;
          m.onboardingStatus = (f.onboardingStatus || f.merchantOpinion || '').trim() || 'Pending';
          m.merchantCategory = (f.merchantCategory || '').trim();
          m.latestOpinion    = (f.merchantOpinion  || '').trim();
        }
      }
      m.visitCount++;
    });

    // Enrich from BT_TL_CONNECT
    if (btCollectionName) {
      const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
      const getStr = (r, keys) => { for (const k of keys) { if (r[k]!==undefined&&r[k]!==null) return String(r[k]).trim(); } return '–'; };
      const btDocs = await db.collection(btCollectionName).find({ merchantNumber: { $in: merchantNums } }).toArray();
      btDocs.forEach(r => {
        const m = merchantMap[(r.merchantNumber||'').trim()];
        if (!m) return;
        m.stage3      = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
        m.stage3Gap   = parseNum(r.stage3Gap || r['Stage-3_GAP']);
        m.passLive    = getStr(r, ['passLive','pass_live','Pass_Live']);
        m.rewardPassPro = getStr(r, ['rewardPassPro','reward_pass_pro','priorityPassPro']);
        m.upiActive   = getStr(r, ['upiActive','upi_active','UPI_Active']);
        m.upiTxnCount = parseNum(r.upiTxnCount || r.upi_txn_count || r.Upi_Txn_Count);
        m.upiAmount   = parseNum(r.withdrawAmount || r.UPI_Amount || r.upiAmount);
        m.priorityPassStatus = getStr(r, ['priorityPassStatus','Priority_Pass_Status']);
        m.msmegstStatus      = getStr(r, ['msmegstStatus','MSME/GST_Status','MSME_GST_Status']);
        m.insuranceStatus    = getStr(r, ['insuranceStatus','Insurance_Status']);
        m.rewardsPassProActiveDate = getStr(r, ['rewardsPassProActiveDate','Rewards_Pass_Pro_Active_Date','priority_pass_active_date']);
        const isLive   = m.passLive.toLowerCase() === 'live';
        const isActive = m.rewardPassPro.toLowerCase() === 'active';
        m.btVerified = isLive || isActive || m.stage3 > 0;
        if (isLive || isActive) m.onboardingStatus = 'Onboarded';
        else if (m.stage3 > 0)  m.onboardingStatus = 'BT Active';
      });
    }

    const merchants = Object.values(merchantMap).sort((a,b) => {
      if (a.lastActivity&&b.lastActivity) return new Date(b.lastActivity)-new Date(a.lastActivity);
      if (a.lastActivity) return -1; if (b.lastActivity) return 1;
      return (a.merchantName||'').localeCompare(b.merchantName||'');
    });

    const result = { success: true, merchants };
    await cacheSet(db, ck, result, 0); // permanent — busted on write
    res.json(result);
  } catch (err) {
    console.error('FSE merchants detail error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/fse/export-excel — Export FSE Onboarding Forms & Merchant BT Data to Excel
router.get('/export-excel', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const db = req.db;
    const { selectedYear, selectedMonth, dateFilter, fromDate, toDate } = req.query;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();

    const isFilterActive = !!(dateFilter && dateFilter !== 'all') || !!selectedYear || !!selectedMonth;

    const filterByDate = (items, dateField = 'createdAt') => {
      if (!isFilterActive) return items;
      const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return items.filter(item => {
        if (!item[dateField]) return false;
        const d = new Date(item[dateField]);
        if (isNaN(d.getTime())) return false;
        if (dateFilter === 'today')  return d >= today && d < new Date(today.getTime() + 86400000);
        if (dateFilter === 'month')  return d >= monthStart && d <= monthEnd;
        if (dateFilter === 'custom') {
          if (fromDate) {
            const from = new Date(fromDate);
            if (!isNaN(from.getTime()) && d < from) return false;
          }
          if (toDate) {
            const to = new Date(toDate + 'T23:59:59');
            if (!isNaN(to.getTime()) && d > to) return false;
          }
          return true;
        }
        if (selectedYear  && d.getFullYear() !== parseInt(selectedYear)) return false;
        if (selectedMonth && MONTHS[d.getMonth()] !== selectedMonth) return false;
        return true;
      });
    };

    // ── 1. Load Forms Data ──
    const [sheetForms, appForms, mobikwikForms] = await Promise.all([
      db.collection('TideBT Form Responses').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('tidebt_form_responses').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('TideBT_Mobikwik').find({}).sort({ createdAt: -1 }).toArray()
    ]);

    const rawForms = [...sheetForms, ...appForms, ...mobikwikForms];
    const filteredForms = filterByDate(rawForms, 'createdAt');

    const sheet1Data = filteredForms.map(f => {
      const isMK = f.formType === 'mobikwik-withdraw';
      return {
        'FSE Name': f.employeeName || f.fseName || '–',
        'Merchant / Customer': f.merchantName || f.customerName || '–',
        'Mobile Number': f.merchantNumber || f.customerNumber || '–',
        'Form Type': isMK ? 'Mobikwik' : 'Daily Visit',
        'Category / Details': isMK ? `Withdrawal ₹${f.withdrawAmount || 0}` : (f.merchantCategory || '–'),
        'Opinion / Status': isMK ? (f.status || f.onboardingStatus || 'Pending') : (f.merchantOpinion || f.onboardingStatus || '–'),
        'Withdraw Amount (₹)': isMK ? (f.withdrawAmount || 0) : 0,
        'Withdraw Fee (₹)': isMK ? Math.round((f.withdrawAmount || 0) * 0.03 * 100) / 100 : 0,
        'Date': f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN') : '–'
      };
    });

    // ── 2. Load Merchant BT Data ──
    const btMonth = selectedMonth || 'July';
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btColName = findBTCollection(allCollections, btMonth, selectedYear);

    let sheet2Data = [];
    if (btColName) {
      const btDocs = await db.collection(btColName).find({}).limit(5000).toArray();
      const masterDocs = await db.collection('bt_master').find({}).toArray();
      const masterMap = {};
      masterDocs.forEach(m => {
        if (m.merchantNumber) masterMap[m.merchantNumber.trim()] = m;
      });

      sheet2Data = btDocs.map(r => {
        const num = (r.merchantNumber || '').trim();
        const master = masterMap[num] || {};
        const stage3Raw = r.stage3 || r.Stage_3 || r['Stage-3'] || '0';
        const stage3 = parseFloat(String(stage3Raw).replace(/,/g, '')) || 0;
        return {
          'FSE Name': master.fseName || r.fseName || '–',
          'TL Name': master.tl || r.tl || '–',
          'Merchant Mobile': num,
          'Merchant Name': master.merchantName || r.merchantName || '–',
          'Month': btMonth,
          'Stage 3 BT (₹)': stage3,
          'Reward Pass Status': r.rewardPassPro || r.priorityPassPro || '–',
          'Pass Live Status': r.passLive || '–',
          'UPI Active': r.upiActive || '–'
        };
      });
    }

    // Build Workbook
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'FSE Onboarding Forms');

    if (sheet2Data.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'FSE Merchants BT Data');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="FSE_Onboarding_Forms_Report_${selectedMonth || 'All'}_${selectedYear || '2026'}.xlsx"`);
    return res.send(buffer);

  } catch (error) {
    console.error('Error exporting FSE excel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fse/:name - Get single FSE details
router.get('/:name', async (req, res) => {
  try {
    const db = req.db;
    const fseName = req.params.name;
    
    // Get FSE from access list
    const access = await db.collection('TideBT_Access').findOne({ 
      name: fseName, 
      role: 'FSE' 
    });
    
    if (!access) {
      return res.status(404).json({ success: false, error: 'FSE not found' });
    }
    
    // Get employee details
    const employee = await db.collection('Employees').findOne({ 
      newJoinerName: fseName 
    });
    
    // Get form count
    const formCount = await db.collection('TideBT Form Responses').countDocuments({ 
      employeeName: fseName 
    });
    
    const fseDetails = {
      name: access.name,
      phone: employee?.newJoinerPhone || '',
      email: employee?.newJoinerEmailId || '',
      reportingManager: employee?.reportingManager || '',
      status: access.status || 'active',
      createdAt: access.createdAt,
      totalForms: formCount
    };
    
    res.json({ success: true, fse: fseDetails });
  } catch (error) {
    console.error('Error fetching FSE details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fse/cache/bust — manually clear all FSE overview caches
// Call this after running sync scripts that update bt_master or BT_TL_CONNECT
router.post('/cache/bust', async (req, res) => {
  try {
    const db = req.db;
    await cacheInvalidate(db, '*');
    res.json({ success: true, message: 'All FSE/TL overview caches cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

