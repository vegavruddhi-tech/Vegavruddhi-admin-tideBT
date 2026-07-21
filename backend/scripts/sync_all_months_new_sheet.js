/**
 * Sync all BT TL CONNECT months from new sheet
 * Sheet: 16Aa1DTlE6SZQnyf8jtk1FpjGndivIENo3Rfp6LxbC2Q
 *
 * Tab → MongoDB Collection mapping:
 *   BT TL CONNECT FEB 26  → BT_TL_CONNECT FEB 26  (already in .env sheet, resync with correct stage3)
 *   BT TL CONNECT MARCH   → BT_TL_CONNECT MARCH
 *   BT TL CONNECT APRIL   → BT_TL_CONNECT APRIL
 *   BT TL CONNECT MAY     → BT_TL_CONNECT MAY
 *   BT TL CONNECT JUNE    → BT_TL_CONNECT JUNE
 *   BT TL CONNECT JULY    → bt_tl_connect july
 */
const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SHEET_ID = process.env.GOOGLE_SHEET_ID; // 1XD1x9VeyGbGnCKw2w8pAlsf6zoxs59OSKxpRDcgmZ6U

const MONTH_MAP = [
  { tab: 'BT TL CONNECT FEB',    collection: 'BT_TL_CONNECT FEB',  month: 'February' },
  { tab: 'BT TL CONNECT MARCH',  collection: 'BT_TL_CONNECT MARCH', month: 'March'    },
  { tab: 'BT TL CONNECT APRIL',  collection: 'BT_TL_CONNECT APRIL', month: 'April'    },
  { tab: 'BT TL CONNECT MAY',    collection: 'BT_TL_CONNECT MAY',   month: 'May'      },
  { tab: 'BT TL CONNECT JUNE ',  collection: 'BT_TL_CONNECT JUNE',  month: 'June'     },
  { tab: 'BT TL CONNECT JULY',   collection: 'bt_tl_connect july',  month: 'July'     },
];

async function syncTab(sheets, db, tabName, collectionName, monthName) {
  console.log(`\n📥 Syncing "${tabName}" → "${collectionName}"...`);

  let res;
  try {
    res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tabName}!A:ZZ` });
  } catch (e) {
    console.log(`  ❌ Could not read tab: ${e.message}`);
    return;
  }

  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('  No data.'); return; }

  const headers = rows[0].map(h => String(h || '').trim());

  const idx = (names) => { for (const n of names) { const i = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase())); if (i !== -1) return i; } return -1; };
  const iMobileNo   = idx(['mobile no']);
  const iNumber     = idx(['number']);
  const iStage3     = headers.findIndex(h => h.toLowerCase().replace(/\s/g,'') === 'stage-3' || h.toLowerCase().replace(/\s/g,'') === 'stage3');
  const iStage3Gap  = idx(['stage-3 gap', 'stage3 gap']);
  const iPassLive   = idx(['pass live', 'pass_live']);
  const iRPPro      = idx(['reward pass pro', 'priority pass pro']);
  const iRPActiveDate = idx(['rewards pass pro active', 'priority pass active']);
  const iUPIActive  = idx(['upi active']);
  const iUPITxn     = idx(['upi txn', 'txn count']);
  const iUPIGap     = idx(['upi gap']);
  const iPartner    = idx(['partner']);
  const iTL         = headers.findIndex(h => h.toLowerCase() === 'tl name' || h.toLowerCase() === 'team lead name');
  const iLead       = headers.findIndex(h => h.toLowerCase() === 'lead');
  const iWithdraw   = idx(['upi amount', 'withdraw amount', 'qr load']);
  const iMSME       = idx(['msme/gst', 'msme status', 'msme']);
  const iInsurance  = idx(['insurance']);
  const iPriority   = idx(['priority pass status']);
  const iTodayS3    = headers.findIndex(h => h.toLowerCase().includes("today's stage"));
  const iYestS3     = headers.findIndex(h => h.toLowerCase().includes("yesterday's stage"));

  console.log(`  Headers mapped: stage3=${iStage3}, mobileNo=${iMobileNo}, passLive=${iPassLive}, rpPro=${iRPPro}`);

  const parseNum = v => { if (!v) return 0; const n = parseFloat(String(v).replace(/,/g,'').trim()); return isNaN(n) ? 0 : n; };
  const getVal  = (row, i) => (i !== -1 && row[i] !== undefined) ? String(row[i]).trim() : '';
  const normMobile = v => { if (!v) return ''; const d = v.replace(/\D/g,''); if (d.length===12&&d.startsWith('91')) return d.slice(2); if (d.length===11&&d.startsWith('0')) return d.slice(1); if (d.length===10) return d; return d; };
  const getMerchantNumber = row => {
    const v = normMobile(getVal(row, iMobileNo)); if (v && v.length >= 7) return v;
    const v2 = normMobile(getVal(row, iNumber)); if (v2 && v2.length >= 7) return v2;
    return v || v2;
  };

  const docs = []; let skipped = 0;
  rows.slice(1).forEach((row, i) => {
    const merchantNumber = getMerchantNumber(row);
    if (!merchantNumber || merchantNumber.length < 7) { skipped++; return; }
    docs.push({
      month: monthName,
      partnerName:      getVal(row, iPartner),
      teamLeadName:     getVal(row, iTL),
      lead:             getVal(row, iLead),
      merchantNumber,
      stage3:           parseNum(getVal(row, iStage3)),
      stage3Gap:        parseNum(getVal(row, iStage3Gap)),
      todaysStage3:     parseNum(getVal(row, iTodayS3)),
      yesterdaysStage3: parseNum(getVal(row, iYestS3)),
      upiActive:        getVal(row, iUPIActive)  || '–',
      upiGap:           getVal(row, iUPIGap)     || '–',
      upiTxnCount:      parseNum(getVal(row, iUPITxn)),
      passLive:         getVal(row, iPassLive)   || '–',
      rewardPassPro:    getVal(row, iRPPro)      || '–',
      rewardsPassProActiveDate: getVal(row, iRPActiveDate) || '–',
      msmegstStatus:    getVal(row, iMSME)       || '–',
      insuranceStatus:  getVal(row, iInsurance)  || '–',
      priorityPassStatus: getVal(row, iPriority) || '–',
      withdrawAmount:   parseNum(getVal(row, iWithdraw)),
      _syncedAt:        new Date(),
      _rowIndex:        i + 2
    });
  });

  console.log(`  Parsed: ${docs.length} valid, skipped: ${skipped}`);

  // Clear and insert
  await db.collection(collectionName).deleteMany({});
  if (docs.length > 0) {
    const result = await db.collection(collectionName).insertMany(docs);
    const totalBT = docs.reduce((s, d) => s + d.stage3, 0);
    const rpActive = docs.filter(d => d.rewardPassPro.toLowerCase() === 'active').length;
    console.log(`  ✅ Inserted ${result.insertedCount} | BT: ₹${totalBT.toLocaleString()} | RP Active: ${rpActive}`);
  }
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('🚀 Starting sync of all months from new sheet...');
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  for (const { tab, collection, month } of MONTH_MAP) {
    await syncTab(sheets, db, tab, collection, month);
  }

  // Clear the summary cache so panels pick up fresh data
  const r = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log(`\n🗑️  Cleared ${r.deletedCount} cache entries`);

  await mongoose.connection.close();
  console.log('\n✅ All months synced! Reload the admin panel to see fresh data.');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
