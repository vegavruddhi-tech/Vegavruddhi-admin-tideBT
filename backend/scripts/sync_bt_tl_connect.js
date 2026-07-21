/**
 * Universal BT TL CONNECT sync script
 * Source: Google Sheet 1ebvpDwSwPV6s-C2QPAkRserFv2yV_6n1NujDZZj4ako
 *
 * Usage:
 *   node scripts/sync_bt_tl_connect.js JUNE
 *   node scripts/sync_bt_tl_connect.js MAY
 *   node scripts/sync_bt_tl_connect.js JULY
 *
 * Syncs "BT TL CONNECT {MONTH}" tab → "BT_TL_CONNECT {MONTH}" MongoDB collection
 */
const { google } = require('googleapis');
const mongoose   = require('mongoose');
const path       = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SHEET_ID = '1ebvpDwSwPV6s-C2QPAkRserFv2yV_6n1NujDZZj4ako';

async function run() {
  const month = (process.argv[2] || 'JUNE').toUpperCase();
  const tabName         = `BT TL CONNECT ${month}`;
  const mongoCollection = `BT_TL_CONNECT ${month}`;

  console.log(`\nSyncing "${tabName}" → "${mongoCollection}"`);

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key:   credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`Fetching data...`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:ZZ`
  });

  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data found.'); return; }

  const headers = rows[0].map(h => String(h || '').trim());
  console.log(`Headers (${headers.length}):`, headers);
  console.log(`Total data rows: ${rows.length - 1}`);

  const idx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iPartner     = idx(['partner name', 'partner']);
  const iTL          = headers.findIndex(h => h.toLowerCase() === 'tl name' || h.toLowerCase() === 'team lead name');
  const iLead        = headers.findIndex(h => h.toLowerCase() === 'lead');
  const iMobileNo    = idx(['mobile no']);
  const iNumber      = idx(['number']);
  const iStage3      = headers.findIndex(h => {
    const hl = h.toLowerCase().replace(/\s/g, '').replace(/-/g, '');
    return hl === 'stage3' || hl === 'stage-3';
  });
  const iStage3Gap   = idx(['stage-3 gap', 'stage3 gap']);
  const iUPIActive   = idx(['upi active']);
  const iUPIAmount   = idx(['upi amount', 'qr load amount']);
  const iUPIGap      = idx(['upi gap']);
  const iUPITxn      = idx(['upi txn', 'txn count']);
  const iPassLive    = idx(['pass live']);
  const iRPPro       = idx(['reward pass pro', 'priority pass pro']);
  const iRPActiveDate = idx(['rewards pass pro active', 'priority pass active']);
  const iMSME        = idx(['msme/gst status', 'msme']);
  const iInsurance   = idx(['insurance status']);
  const iPriority    = idx(['priority pass status']);
  const iTodayS3     = headers.findIndex(h => h.toLowerCase().includes("today's stage"));
  const iYestS3      = headers.findIndex(h => h.toLowerCase().includes("yesterday's stage"));

  console.log('Key column indices:', { iLead, iMobileNo, iNumber, iStage3, iRPPro, iPassLive });

  const parseNum = (val) => {
    if (!val) return 0;
    const n = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  };

  const getVal = (row, i) => (i !== -1 && row[i] !== undefined) ? String(row[i]).trim() : '';

  const normMobile = (val) => {
    if (!val) return '';
    const d = val.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) return d.slice(2);
    if (d.length === 11 && d.startsWith('0')) return d.slice(1);
    return d;
  };

  const getMerchantNumber = (row) => {
    const v  = normMobile(getVal(row, iNumber));
    if (v && v.length >= 7) return v;
    const v2 = normMobile(getVal(row, iMobileNo));
    if (v2 && v2.length >= 7) return v2;
    return v || v2;
  };

  const docs = [];
  let skipped = 0;
  rows.slice(1).forEach((row, i) => {
    const merchantNumber = getMerchantNumber(row);
    if (!merchantNumber || merchantNumber.length < 7) { skipped++; return; }
    docs.push({
      partnerName:    getVal(row, iPartner),
      tlName:         getVal(row, iTL),
      lead:           getVal(row, iLead),
      merchantNumber,
      stage3:         parseNum(getVal(row, iStage3)),
      stage3Gap:      parseNum(getVal(row, iStage3Gap)),
      todaysStage3:   parseNum(getVal(row, iTodayS3)),
      yesterdaysStage3: parseNum(getVal(row, iYestS3)),
      upiActive:      getVal(row, iUPIActive)   || '–',
      upiGap:         getVal(row, iUPIGap)      || '–',
      upiTxnCount:    parseNum(getVal(row, iUPITxn)),
      withdrawAmount: parseNum(getVal(row, iUPIAmount)),
      passLive:       getVal(row, iPassLive)    || '–',
      rewardPassPro:  getVal(row, iRPPro)       || '–',
      rewardsPassProActiveDate: getVal(row, iRPActiveDate) || '–',
      msmegstStatus:  getVal(row, iMSME)        || '–',
      insuranceStatus: getVal(row, iInsurance)  || '–',
      priorityPassStatus: getVal(row, iPriority) || '–',
      _syncedAt: new Date()
    });
  });

  console.log(`Parsed: ${docs.length} valid, skipped: ${skipped}`);
  console.log('Sample:', docs.slice(0, 2).map(d => `${d.merchantNumber} | lead=${d.lead} | stage3=₹${d.stage3} | rp=${d.rewardPassPro}`));

  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const existing = await db.collection(mongoCollection).countDocuments();
  console.log(`Existing in "${mongoCollection}": ${existing} → clearing...`);
  await db.collection(mongoCollection).deleteMany({});

  if (docs.length > 0) {
    await db.collection(mongoCollection).insertMany(docs);
    const withBT = docs.filter(d => d.stage3 > 0).length;
    const withRP = docs.filter(d => (d.rewardPassPro || '').toLowerCase() === 'active').length;
    const totalBT = docs.reduce((s, d) => s + d.stage3, 0);
    console.log(`\n✅ Inserted ${docs.length} into "${mongoCollection}"`);
    console.log(`   BT > 0: ${withBT} | RP Active: ${withRP} | Total BT: ₹${totalBT.toLocaleString()}`);
  }

  await mongoose.connection.close();
  console.log('Done!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
