const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const targetMonth = process.argv[2] || 'July';
  const targetYear  = parseInt(process.argv[3]) || 2026;

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId  = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID_2;

  if (!mongoUri || !sheetId) {
    console.error('❌ Missing MONGODB_URI or sheet ID in .env');
    process.exit(1);
  }

  // 1. Google Sheets Auth
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`📥 Fetching FT tab (Columns A to K) for ${targetMonth} ${targetYear}...`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'FT!A:K'
  });

  const rows = res.data.values || [];
  if (rows.length < 3) {
    console.log('❌ No data found in sheet.');
    return;
  }

  const parseAmount = (val) => {
    if (!val) return 0;
    const str = String(val).trim();
    const isNegative = str.startsWith('-');
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return isNegative ? -num : num;
  };

  const docs = [];

  rows.slice(2).forEach((row) => {
    const tlName = (row[3] || '').trim();
    const tlBalance = parseAmount(row[2]);

    const fseNameA = (row[0]  || '').trim();
    const fseNameK = (row[10] || '').trim();
    const fseName  = fseNameA || fseNameK;
    const fseBalance = parseAmount(row[8]);
    const fseTLName  = (row[9] || '').trim();

    if (tlName) {
      docs.push({
        type: 'TL',
        name: tlName,
        openingBalance: tlBalance,
        month: targetMonth,
        year: targetYear,
        _syncedAt: new Date()
      });
    }

    if (fseName) {
      docs.push({
        type: 'FSE',
        name: fseName,
        openingBalance: fseBalance,
        tlName: fseTLName || null,
        month: targetMonth,
        year: targetYear,
        _syncedAt: new Date()
      });
    }
  });

  console.log(`\nParsed ${docs.length} records (${docs.filter(d => d.type === 'TL').length} TLs, ${docs.filter(d => d.type === 'FSE').length} FSEs) for ${targetMonth} ${targetYear}.`);

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const collectionName = 'TideBT_OpeningBalances';

  // Wipe ALL old untagged/duplicate documents
  const r = await db.collection(collectionName).deleteMany({});
  console.log(`🧹 Cleaned all ${r.deletedCount} old records in '${collectionName}'.`);

  if (docs.length > 0) {
    await db.collection(collectionName).insertMany(docs);
    console.log(`✅ Successfully inserted ${docs.length} fresh records with month="${targetMonth}", year=${targetYear}!`);
  }

  await mongoose.connection.close();
  console.log('Sync Complete! 🎉');
}

run().catch(e => console.error('❌ Sync Error:', e.message));
