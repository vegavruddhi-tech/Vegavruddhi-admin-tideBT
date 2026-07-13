/**
 * Sync TL & FSE Opening Balances from Google Sheets (FT tab) to MongoDB
 * Actual sheet layout (Row 2 = real headers):
 *   A: FSE Name
 *   C: Opening Balance of TL
 *   D: TL NAME
 *   I: Opening Balance of FSE
 *   J: TL Name (for FSE)
 *   K: FSE Name (same as A, second column)
 */

const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId  = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID_2;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI/MONGO_URI not found in .env');
    process.exit(1);
  }
  if (!sheetId) {
    console.error('❌ TIDEBT_SHEET_ID/GOOGLE_SHEET_ID_2 not found in .env');
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

  console.log('📥 Fetching FT tab (Columns A to K)...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'FT!A:K' // Fetches columns A through K
  });

  const rows = res.data.values || [];
  if (rows.length < 3) {
    console.log('❌ No data found in sheet (need at least 3 rows — title, headers, data).');
    return;
  }

  // Row 1 (index 0) is a title/summary row — skip it
  // Row 2 (index 1) is the real headers row
  console.log(`Headers row:`, rows[1]);

  // Helper to parse numeric values safely
  const parseAmount = (val) => {
    if (!val) return 0;
    const str = String(val).trim();
    const isNegative = str.startsWith('-');
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return isNegative ? -num : num;
  };

  const docs = [];

  // Range is A:K so indexes (0-based) are:
  // Column A (0): FSE Name
  // Column B (1): (empty/unused)
  // Column C (2): Opening Balance of TL
  // Column D (3): TL NAME
  // Column E (4): Received
  // Column F (5): Send to
  // Column G (6): In Hand
  // Column H (7): (empty/unused)
  // Column I (8): Opening Balance of FSE
  // Column J (9): TL Name (for FSE)
  // Column K (10): FSE Name (alternative column)

  // Skip rows 0 (title) and 1 (headers) — data starts at row index 2
  rows.slice(2).forEach((row) => {
    // Process TL Row Data (columns C and D)
    const tlName = (row[3] || '').trim();
    const tlBalance = parseAmount(row[2]);
    
    // Process FSE Row Data — FSE name is in col A (index 0) or col K (index 10)
    // Prefer col A; fall back to col K
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
        _syncedAt: new Date()
      });
    }

    if (fseName) {
      docs.push({
        type: 'FSE',
        name: fseName,
        openingBalance: fseBalance,
        tlName: fseTLName || null,
        _syncedAt: new Date()
      });
    }
  });

  console.log(`\nParsed ${docs.length} records (${docs.filter(d => d.type === 'TL').length} TLs, ${docs.filter(d => d.type === 'FSE').length} FSEs).`);

  // Connect and Save to MongoDB
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const collectionName = 'TideBT_OpeningBalances';
  
  // Clear old data first
  await db.collection(collectionName).deleteMany({});
  console.log(`Cleared existing records in '${collectionName}'.`);

  if (docs.length > 0) {
    await db.collection(collectionName).insertMany(docs);
    console.log(`✅ Successfully synced ${docs.length} records to MongoDB collection '${collectionName}'.`);
  }

  await mongoose.connection.close();
  console.log('Sync Complete! 🎉');
}

run().catch(e => console.error('❌ Sync Error:', e.message));
