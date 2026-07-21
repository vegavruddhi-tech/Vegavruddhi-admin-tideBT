/**
 * Sync TideBT_Access from "Acess" tab in TIDEBT_SHEET_ID
 *
 * Tab format (A:D):
 *   A: FSE EMAIL
 *   B: FSE (fseName)
 *   C: TL  (tlName — canonical name, source of truth)
 *   D: TL EMAIL (tlEmail — used to match TL login)
 *
 * Stores: fseEmail, fseName, tlName, tlEmail, hasTideBTAccess: true
 */
const { google } = require('googleapis');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId  = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID_2;

  // Google Auth
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Fetch A:D (4 columns now — added TL EMAIL in column D)
  console.log('Fetching data from "Acess" tab (A:D)...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Acess!A:D'
  });
  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data found.'); return; }

  const headers = rows[0].map(h => (h || '').trim().toUpperCase());
  console.log('Headers:', headers);

  // Detect column indices by header name — flexible, handles column reordering
  const fseEmailIdx = headers.findIndex(h => h.includes('FSE') && h.includes('EMAIL'));
  const fseNameIdx  = headers.findIndex(h => h === 'FSE' || (h.includes('FSE') && !h.includes('EMAIL')));
  const tlNameIdx   = headers.findIndex(h => h === 'TL'  || (h.includes('TL')  && !h.includes('EMAIL') && !h.includes('MAIL')));
  const tlEmailIdx  = headers.findIndex(h => h.includes('TL') && h.includes('EMAIL'));

  console.log('Column indices:', { fseEmailIdx, fseNameIdx, tlNameIdx, tlEmailIdx });

  if (fseNameIdx === -1 || tlNameIdx === -1) {
    console.error('❌ Could not find FSE or TL columns. Check sheet headers.');
    return;
  }

  const dataRows = rows.slice(1);
  const docs = dataRows
    .filter(r => r[fseNameIdx] && r[tlNameIdx])
    .map(r => ({
      fseEmail:        (r[fseEmailIdx] || '').trim().toLowerCase(),
      fseName:         (r[fseNameIdx]  || '').trim(),
      tlName:          (r[tlNameIdx]   || '').trim(),
      tlEmail:         tlEmailIdx !== -1 ? (r[tlEmailIdx] || '').trim().toLowerCase() : '',
      hasTideBTAccess: true,
      _syncedAt:       new Date()
    }));

  console.log(`\nExtracted ${docs.length} records.`);

  // Show sample
  docs.slice(0, 5).forEach(d =>
    console.log(`  FSE: "${d.fseName}" (${d.fseEmail}) → TL: "${d.tlName}" (${d.tlEmail || 'no TL email'})`)
  );

  // Show unique TLs and their emails
  const tlMap = {};
  docs.forEach(d => { if (d.tlName) tlMap[d.tlName] = d.tlEmail || '(none)'; });
  console.log('\nTL email mapping:');
  Object.entries(tlMap).forEach(([name, email]) => console.log(`  "${name}" → ${email}`));

  // Connect to MongoDB
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  // Replace all existing records
  const delRes = await db.collection('TideBT_Access').deleteMany({});
  console.log(`\nDeleted ${delRes.deletedCount} existing records.`);

  if (docs.length > 0) {
    await db.collection('TideBT_Access').insertMany(docs);
    console.log(`✅ Inserted ${docs.length} records into TideBT_Access.`);
  }

  // Create index on tlEmail for fast lookup
  await db.collection('TideBT_Access').createIndex({ tlEmail: 1 });
  await db.collection('TideBT_Access').createIndex({ fseEmail: 1 });
  console.log('✅ Indexes created on tlEmail and fseEmail.');

  await mongoose.connection.close();
  console.log('\nDone! ✅');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
