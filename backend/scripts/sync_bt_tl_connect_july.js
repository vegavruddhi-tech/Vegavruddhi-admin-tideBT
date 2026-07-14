/**
 * Sync BT_TL_CONNECT JULY from Google Sheet
 * Sheet ID : 1XD1x9VeyGbGnCKw2w8pAlsf6zoxs59OSKxpRDcgmZ6U  (GOOGLE_SHEET_ID)
 * Tab name : BT TL CONNECT JULY
 * Collection: BT_TL_CONNECT JULY
 */
const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri        = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId         = process.env.GOOGLE_SHEET_ID; // 1XD1x9VeyGbGnCKw2w8pAlsf6zoxs59OSKxpRDcgmZ6U
  const tabName         = 'BT TL CONNECT JULY';
  const mongoCollection = 'BT_TL_CONNECT JULY'; // canonical uppercase+space format — picked first by collection picker

  if (!sheetId) { console.error('GOOGLE_SHEET_ID not set in .env'); process.exit(1); }

  // ── Google Auth ───────────────────────────────────────────────────────────
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── Fetch sheet tab ───────────────────────────────────────────────────────
  console.log(`📥 Fetching "${tabName}" from sheet ${sheetId}...`);
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:ZZ`
    });
  } catch (e) {
    console.error(`❌ Could not read tab "${tabName}":`, e.message);
    console.log('\nTip: Run scan_all_spreadsheets.js to list available tab names.');
    process.exit(1);
  }

  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data found in tab.'); return; }

  const rawHeaders = rows[0];
  const headers    = rawHeaders.map(h => String(h || '').trim());
  console.log(`Headers (${headers.length}):`, headers);
  console.log(`Total data rows: ${rows.length - 1}`);

  // ── Column index helpers ──────────────────────────────────────────────────
  const idx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iMonth      = idx(['month']);
  const iPartner    = idx(['partner']);
  const iTL         = headers.findIndex(h => h.toLowerCase() === 'tl name' || h.toLowerCase() === 'team lead name');
  const iLead       = headers.findIndex(h => h.toLowerCase() === 'lead');
  const iMobileNo   = idx(['mobile no']);
  const iNumber     = idx(['number']);
  const iStage3     = headers.findIndex(h => h.toLowerCase().replace(/\s/g,'') === 'stage-3' || h.toLowerCase().replace(/\s/g,'') === 'stage3');
  const iStage3Gap  = idx(['stage-3 gap', 'stage3 gap', 'stage_3_gap']);
  const iUPIActive  = idx(['upi active', 'upi_active']);
  const iUPIGap     = idx(['upi gap', 'upi_gap']);
  const iUPITxn     = idx(['upi txn', 'upi_txn', 'txn count']);
  const iPassLive   = idx(['pass live', 'pass_live']);
  const iRPPro      = idx(['priority pass pro', 'reward pass pro']);
  const iRPActiveDate = idx(['priority pass active', 'reward pass pro active']);
  const iMSME       = idx(['msme/gst status', 'msme', 'gst']);
  const iInsurance  = idx(['insurance status']);
  const iPriority   = idx(['priority pass status']);
  const iWithdraw   = idx(['qr load amount', 'upi amount', 'withdraw amount']);
  const iTodayS3    = headers.findIndex(h => h.toLowerCase().includes("today's stage"));
  const iYestS3     = headers.findIndex(h => h.toLowerCase().includes("yesterday's stage"));

  console.log('\nColumn mapping:');
  console.log({ iMonth, iPartner, iTL, iLead, iMobileNo, iNumber, iStage3, iStage3Gap, iUPIActive, iPassLive, iRPPro });

  // ── Parse helpers ─────────────────────────────────────────────────────────
  const parseNum = (val) => {
    if (!val) return 0;
    const n = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  };

  const getVal = (row, i) => (i !== -1 && row[i] !== undefined) ? String(row[i]).trim() : '';

  const normalizeMobile = (val) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0'))  return digits.slice(1);
    if (digits.length === 10) return digits;
    return digits;
  };

  const getMerchantNumber = (row) => {
    const v  = normalizeMobile(getVal(row, iMobileNo));
    if (v && v.length >= 7) return v;
    const v2 = normalizeMobile(getVal(row, iNumber));
    if (v2 && v2.length >= 7) return v2;
    return v || v2;
  };

  // ── Build documents ───────────────────────────────────────────────────────
  const docs = [];
  let skipped = 0;

  rows.slice(1).forEach((row, i) => {
    const merchantNumber = getMerchantNumber(row);
    if (!merchantNumber || merchantNumber.length < 7) { skipped++; return; }

    docs.push({
      month:            getVal(row, iMonth)     || 'July',
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

  console.log(`\nParsed: ${docs.length} valid records, skipped: ${skipped}`);
  console.log('\nSample records:');
  docs.slice(0, 3).forEach(d =>
    console.log(`  ${d.merchantNumber} | lead=${d.lead} | tl=${d.teamLeadName} | stage3=₹${d.stage3.toLocaleString()} | rp=${d.rewardPassPro}`)
  );

  // ── Connect MongoDB & sync ────────────────────────────────────────────────
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const existing = await db.collection(mongoCollection).countDocuments();
  console.log(`\nExisting records in "${mongoCollection}": ${existing}`);

  await db.collection(mongoCollection).deleteMany({});
  console.log('Cleared old data.');

  if (docs.length > 0) {
    const result = await db.collection(mongoCollection).insertMany(docs);
    console.log(`✅ Inserted ${result.insertedCount} records into "${mongoCollection}".`);

    const withBT  = docs.filter(d => d.stage3 > 0).length;
    const withRP  = docs.filter(d => d.rewardPassPro.toLowerCase() === 'active').length;
    const totalBT = docs.reduce((s, d) => s + d.stage3, 0);
    console.log(`\nStats:`);
    console.log(`  Merchants with BT > 0 : ${withBT}`);
    console.log(`  Merchants with RP Active: ${withRP}`);
    console.log(`  Total BT Amount        : ₹${totalBT.toLocaleString()}`);
  }

  await mongoose.connection.close();
  console.log('\nDone! ✅');
  console.log('\n⚠️  Remember to bust the API cache after this sync:');
  console.log('   POST /api/fse/cache/bust   or   POST /api/tl/cache/bust');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
