/**
 * Sync "Master" tab from Google Sheet → MongoDB "bt_master" collection
 * Columns synced: Email Address, Merchant Name, Number, FSE Name, Email, TL
 *
 * Usage:
 *   node scripts/syncMaster.js
 *   node scripts/syncMaster.js --clear    (clears collection before sync)
 */

const { google }  = require('googleapis');
const mongoose    = require('mongoose');
const path        = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SHEET_ID      = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID;
const TAB_NAME      = 'Master';
const COLLECTION    = 'bt_master';
const CLEAR         = process.argv.includes('--clear');

// ── Column name → MongoDB field mapping ──────────────────────────────────────
// Only these 6 columns will be stored; everything else is ignored.
const COLUMN_MAP = {
  'email address':   'merchantEmail',
  'merchant name':   'merchantName',
  'number':          'merchantNumber',
  'fse name':        'fseName',
  'email':           'fseEmail',
  'tl':              'tl',
};

const mapHeader = (raw) => {
  const clean = (raw || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').trim();
  return COLUMN_MAP[clean] || null; // null = skip this column
};

// ── Normalize phone number to 10 digits ──────────────────────────────────────
const normPhone = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`🚀 Syncing "${TAB_NAME}" → MongoDB "${COLLECTION}"...`);

  if (!SHEET_ID) {
    console.error('❌ No SHEET_ID found in .env (TIDEBT_SHEET_ID or GOOGLE_SHEET_ID)');
    process.exit(1);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } catch {
    console.error('❌ GOOGLE_CREDENTIALS_JSON is missing or invalid in .env');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── Fetch sheet data ──────────────────────────────────────────────────────
  console.log(`📄 Fetching tab "${TAB_NAME}"...`);
  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: TAB_NAME,
    });
    rows = res.data.values || [];
  } catch (err) {
    console.error('❌ Failed to fetch sheet:', err.message);
    process.exit(1);
  }

  if (rows.length < 2) {
    console.log('⚠️  No data rows found (sheet has < 2 rows).');
    process.exit(0);
  }

  // ── Parse headers ─────────────────────────────────────────────────────────
  const headers = rows[0];
  const fieldMap = headers.map(h => mapHeader(h)); // index → field name or null
  const includedCols = fieldMap.reduce((acc, f, i) => { if (f) acc.push(i); return acc; }, []);

  console.log(`📋 Headers: ${headers.join(' | ')}`);
  console.log(`✅ Mapped columns: ${includedCols.map(i => `"${headers[i]}" → ${fieldMap[i]}`).join(', ')}`);

  if (includedCols.length === 0) {
    console.error('❌ None of the required columns found in the sheet. Check column names.');
    process.exit(1);
  }

  // ── Build documents ───────────────────────────────────────────────────────
  const dataRows = rows.slice(1);
  const docs = [];

  dataRows.forEach((row, idx) => {
    const doc = { _syncedAt: new Date(), _tab: TAB_NAME, _sheet: SHEET_ID };
    let hasData = false;

    includedCols.forEach(colIdx => {
      const field = fieldMap[colIdx];
      const rawVal = (row[colIdx] || '').toString().trim();
      if (!rawVal) return;

      // Normalize phone number fields
      if (field === 'merchantNumber') {
        const normalized = normPhone(rawVal);
        if (normalized) { doc[field] = normalized; hasData = true; }
      } else {
        doc[field] = rawVal;
        hasData = true;
      }
    });

    if (hasData) docs.push(doc);
  });

  console.log(`📊 Parsed ${docs.length} valid rows from ${dataRows.length} data rows.`);

  // ── Connect to MongoDB ────────────────────────────────────────────────────
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) { console.error('❌ No MongoDB URI in .env'); process.exit(1); }

  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;
  const col = db.collection(COLLECTION);

  if (CLEAR) {
    const del = await col.deleteMany({});
    console.log(`🗑️  Cleared ${del.deletedCount} existing records.`);
  }

  // ── Upsert by merchantNumber + fseName ────────────────────────────────────
  let inserted = 0, updated = 0, skipped = 0;

  for (const doc of docs) {
    if (!doc.merchantNumber && !doc.merchantName) { skipped++; continue; }

    const filter = {};
    if (doc.merchantNumber) filter.merchantNumber = doc.merchantNumber;
    else if (doc.merchantName && doc.fseName) {
      filter.merchantName = doc.merchantName;
      filter.fseName = doc.fseName;
    } else { skipped++; continue; }

    const result = await col.updateOne(filter, { $set: doc }, { upsert: true });
    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }

  console.log(`✅ Done! Inserted: ${inserted} | Updated: ${updated} | Skipped: ${skipped}`);
  await mongoose.connection.close();
}

run().catch(err => { console.error('❌ Fatal error:', err.message); process.exit(1); });
