/**
 * Sync TideBT_Mobikwik from "MK" tab
 * Sheet: TIDEBT_SHEET_ID (15RKWpRHsBbtjiMsCdDK17JUYXnu3mgL0nqY6YoNrtzc)
 * Collection: TideBT_Mobikwik
 *
 * Columns:
 *   A: Timestamp         B: Email Address     C: Merchant Name
 *   D: Merchant Number   E: Withdraw Amount   F: Withdraw Fees
 *   G: Reason of Withdraw  H: Transaction Date  J(9): FSE   K(10): TL
 *   L(11): Month         M(12): Withdrawl Amount included Fee
 */
const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId  = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID_2;

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('📥 Fetching MK tab...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'MK!A:Q'
  });
  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data found.'); return; }

  const headers = rows[0];
  console.log('Headers:', headers);
  console.log('Total rows:', rows.length - 1);

  const parseAmount = v => parseFloat(String(v || '0').replace(/[^0-9.]/g, '')) || 0;
  const parseDate   = v => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };

  const docs = [];
  let skipped = 0;

  rows.slice(1).forEach((row, i) => {
    const merchantNumber = (row[3] || '').trim().replace(/\D/g, '');
    if (!merchantNumber || merchantNumber.length < 7) { skipped++; return; }

    docs.push({
      createdAt:        parseDate(row[0]) || new Date(),
      employeeEmail:    (row[1] || '').trim().toLowerCase(),
      merchantName:     (row[2] || '').trim(),
      merchantNumber,
      withdrawAmount:   parseAmount(row[4]),
      withdrawFees:     parseAmount(row[5]),
      reasonOfWithdraw: (row[6] || '').trim(),
      transactionDate:  parseDate(row[7]) || parseDate(row[14]),
      employeeName:     (row[9] || '').trim(),   // FSE column
      tlName:           (row[10] || '').trim(),  // TL column
      month:            (row[11] || '').trim(),
      formType:         'mobikwik-withdraw',
      source:           'mk-sheet-sync',
      _syncedAt:        new Date(),
      _rowIndex:        i + 2
    });
  });

  console.log(`\nParsed: ${docs.length} valid records, skipped: ${skipped}`);
  console.log('\nSample:');
  docs.slice(0, 3).forEach(d => console.log(`  ${d.employeeName} → ${d.merchantName} (${d.merchantNumber}): ₹${d.withdrawAmount} | ${d.month}`));

  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const existing = await db.collection('TideBT_Mobikwik').countDocuments();
  console.log(`\nExisting records in TideBT_Mobikwik: ${existing}`);

  await db.collection('TideBT_Mobikwik').deleteMany({});
  console.log('Cleared old data.');

  if (docs.length > 0) {
    const result = await db.collection('TideBT_Mobikwik').insertMany(docs);
    console.log(`✅ Inserted ${result.insertedCount} records into TideBT_Mobikwik.`);

    const totalWithdrawn = docs.reduce((s, d) => s + d.withdrawAmount, 0);
    console.log(`\nStats:`);
    console.log(`  Total withdrawn: ₹${totalWithdrawn.toLocaleString()}`);
    console.log(`  Unique FSEs: ${new Set(docs.map(d => d.employeeName).filter(Boolean)).size}`);
  }

  await mongoose.connection.close();
  console.log('\nDone! ✅');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
