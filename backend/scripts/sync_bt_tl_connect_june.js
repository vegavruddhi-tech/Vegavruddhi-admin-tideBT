/**
 * Sync BT_TL_CONNECT JUNE from "TL connect June" tab
 * Sheet: GOOGLE_SHEET_ID (1XD1x9VeyGbGnCKw2w8pAlsf6zoxs59OSKxpRDcgmZ6U)
 * Collection: BT_TL_CONNECT JUNE
 *
 * Headers detected:
 *   Month | Partner name | Team Lead Name | Lead | Mobile No. | Number | Stage-3 | Stage-3 GAP
 *   + likely more columns for UPI, Reward Pass Pro, Pass Live etc.
 */
const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri  = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId   = '1ebvpDwSwPV6s-C2QPAkRserFv2yV_6n1NujDZZj4ako';
  const tabName   = 'BT TL CONNECT JUNE';
  const mongoCollection = 'BT_TL_CONNECT JUNE';

  // Google Auth
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key:   credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Fetch ALL rows from the tab
  console.log(`Fetching "${tabName}" from sheet ${sheetId}...`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!A:ZZ`   // wide range to capture all columns
  });

  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data found in tab.'); return; }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(h => String(h || '').trim());
  console.log(`Headers (${headers.length}):`, headers);
  console.log(`Total data rows: ${rows.length - 1}`);

  // Column index helpers
  const idx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iMonth       = idx(['month']);
  const iPartner     = idx(['partner']);
  const iTL          = headers.findIndex(h => h.toLowerCase() === 'tl name' || h.toLowerCase() === 'team lead name');
  // "Lead" is col 3 — must find EXACT "Lead" not "Team Lead Name"
  // Use direct index since we know the structure
  const iLead        = headers.findIndex(h => h.toLowerCase() === 'lead');
  const iMobileNo    = idx(['mobile no']);
  const iNumber      = idx(['number']);
  const iStage3      = headers.findIndex(h => h.toLowerCase().replace(/\s/g,'') === 'stage-3' || h.toLowerCase().replace(/\s/g,'') === 'stage3');
  const iStage3Gap   = idx(['stage-3 gap', 'stage3 gap', 'stage_3_gap']);
  const iUPIActive   = idx(['upi active', 'upi_active']);
  const iUPIGap      = idx(['upi gap', 'upi_gap']);
  const iUPITxn      = idx(['upi txn', 'upi_txn', 'txn count']);
  const iPassLive    = idx(['pass live', 'pass_live']);
  const iRPPro       = idx(['priority pass pro', 'reward pass pro']);
  const iRPActiveDate = idx(['priority pass active', 'reward pass pro active']);
  const iMSME        = idx(['msme/gst status', 'msme', 'gst']);
  const iInsurance   = idx(['insurance status']);
  const iPriority    = idx(['priority pass status']);
  const iWithdraw    = idx(['qr load amount', 'upi amount', 'withdraw amount']);
  const iTodayStage3 = headers.findIndex(h => h.toLowerCase().includes("today's stage"));
  const iYestStage3  = headers.findIndex(h => h.toLowerCase().includes("yesterday's stage"));

  console.log('\nColumn mapping:');
  console.log({ iMonth, iPartner, iTL, iLead, iMobileNo, iNumber, iStage3, iStage3Gap, iUPIActive, iPassLive, iRPPro });

  const parseNum = (val) => {
    if (!val) return 0;
    const n = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  };

  const getVal = (row, i) => (i !== -1 && row[i] !== undefined) ? String(row[i]).trim() : '';

  // merchantNumber: prefer "Mobile No." column; fallback to "Number"
  // Normalize: strip country code (91 prefix), keep last 10 digits
  const normalizeMobile = (val) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length === 10) return digits;
    return digits; // return as-is for non-standard lengths
  };

  const getMerchantNumber = (row) => {
    const v  = normalizeMobile(getVal(row, iMobileNo));
    if (v && v.length >= 7) return v;
    const v2 = normalizeMobile(getVal(row, iNumber));
    if (v2 && v2.length >= 7) return v2;
    return v || v2;
  };

  const docs = [];
  let skipped = 0;

  rows.slice(1).forEach((row, i) => {
    const merchantNumber = getMerchantNumber(row);
    // Skip rows with no valid merchant number
    if (!merchantNumber || merchantNumber.length < 7) { skipped++; return; }

    const doc = {
      month:          getVal(row, iMonth)       || 'June',
      partnerName:    getVal(row, iPartner),
      teamLeadName:   getVal(row, iTL),
      lead:           getVal(row, iLead),
      merchantNumber,
      stage3:         parseNum(getVal(row, iStage3)),
      stage3Gap:      parseNum(getVal(row, iStage3Gap)),
      todaysStage3:   parseNum(getVal(row, iTodayStage3)),
      yesterdaysStage3: parseNum(getVal(row, iYestStage3)),
      upiActive:      getVal(row, iUPIActive)   || '–',
      upiGap:         getVal(row, iUPIGap)      || '–',
      upiTxnCount:    parseNum(getVal(row, iUPITxn)),
      passLive:       getVal(row, iPassLive)    || '–',
      rewardPassPro:  getVal(row, iRPPro)       || '–',
      rewardsPassProActiveDate: getVal(row, iRPActiveDate) || '–',
      msmegstStatus:  getVal(row, iMSME)        || '–',
      insuranceStatus: getVal(row, iInsurance)  || '–',
      priorityPassStatus: getVal(row, iPriority) || '–',
      withdrawAmount: parseNum(getVal(row, iWithdraw)),
      _syncedAt:      new Date(),
      _rowIndex:      i + 2
    };

    docs.push(doc);
  });

  console.log(`\nParsed: ${docs.length} valid records, skipped: ${skipped}`);

  // Sample
  console.log('\nSample records:');
  docs.slice(0, 3).forEach(d => console.log(`  ${d.merchantNumber} | lead=${d.lead} | tl=${d.teamLeadName} | stage3=₹${d.stage3.toLocaleString()} | rp=${d.rewardPassPro}`));

  // Connect MongoDB
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  // Drop existing collection and re-insert fresh
  const existing = await db.collection(mongoCollection).countDocuments();
  console.log(`\nExisting records in "${mongoCollection}": ${existing}`);

  await db.collection(mongoCollection).deleteMany({});
  console.log(`Cleared old data.`);

  if (docs.length > 0) {
    const result = await db.collection(mongoCollection).insertMany(docs);
    console.log(`✅ Inserted ${result.insertedCount} records into "${mongoCollection}".`);

    // Stats
    const withBT = docs.filter(d => d.stage3 > 0).length;
    const withRP = docs.filter(d => d.rewardPassPro.toLowerCase() === 'active').length;
    const totalBT = docs.reduce((s, d) => s + d.stage3, 0);
    console.log(`\nStats:`);
    console.log(`  Merchants with BT > 0: ${withBT}`);
    console.log(`  Merchants with RP Active: ${withRP}`);
    console.log(`  Total BT Amount: ₹${totalBT.toLocaleString()}`);
  }

  await mongoose.connection.close();
  console.log('\nDone!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
