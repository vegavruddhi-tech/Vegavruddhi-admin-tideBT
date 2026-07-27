/**
 * Sync TideBT_Payments from "PT." tab
 * Sheet: 15RKWpRHsBbtjiMsCdDK17JUYXnu3mgL0nqY6YoNrtzc  (TIDEBT_SHEET_ID)
 *
 * PT. tab columns (A:J):
 *   A: Timestamp
 *   B: Email Address
 *   C: Transfer to Whom   ("TL's & Managers" OR "FSE Ground Team" / "FSC Ground Team")
 *   D: Sender Name        (TL payment sender)
 *   E: Transfer to        (TL recipient name)
 *   F: Amount             (TL amount)
 *   G: Sender Name        (FSE payment sender)
 *   H: Transfer to (FSE/Ground Team Name)
 *   I: Amount             (FSE amount)
 *   J: Payment done on
 */

const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId  = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID_2;
  // '15RKWpRHsBbtjiMsCdDK17JUYXnu3mgL0nqY6YoNrtzc'

  // ── Google Auth ───────────────────────────────────────────────────────────
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('📥 Fetching PT. tab...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'PT.!A:J'
  });
  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data.'); return; }

  const headers = rows[0];
  console.log('Headers:', headers);
  console.log('Total rows:', rows.length - 1);

  const parseDate = (val) => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const parseAmount = (val) => {
    if (!val) return 0;
    const str = String(val).trim();
    const isNegative = str.startsWith('-');
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return isNegative ? -num : num;
  };

  const docs = [];
  let skipped = 0;

  rows.slice(1).forEach((row, idx) => {
    const timestamp      = row[0] || '';
    const transferToWhom = (row[2] || '').trim();
    const paymentDoneOn  = (row[9] || '').trim();

    let senderName, transferTo, amount;

    // Detect TL vs FSE payment by col C
    const whomLower = transferToWhom.toLowerCase();
    const isTL = whomLower.includes('tl') || whomLower.includes('manager');

    if (isTL) {
      // TL payment: cols D(3), E(4), F(5)
      senderName = (row[3] || '').trim();
      transferTo = (row[4] || '').trim();
      amount     = parseAmount(row[5]);
    } else {
      // FSE/FSC Ground Team payment: cols G(6), H(7), I(8)
      senderName = (row[6] || '').trim();
      transferTo = (row[7] || '').trim();
      amount     = parseAmount(row[8]);
    }

    if (!transferTo || !amount) {
      skipped++;
      return;
    }

    // Normalize transferToWhom — FSC Ground Team → FSE Ground Team (same thing)
    const normalizedWhom = isTL ? "TL's & Managers" : "FSE Ground Team";

    docs.push({
      transferToWhom: normalizedWhom,
      senderName,
      transferTo,
      amount,
      paymentDoneOn,
      source: 'pt-sheet-sync',
      createdAt: parseDate(timestamp),
      _syncedAt: new Date()
    });
  });

  console.log(`\nParsed: ${docs.length} valid payments, skipped: ${skipped}`);

  // Sample
  console.log('\nSample TL payments:');
  docs.filter(d => d.transferToWhom === "TL's & Managers").slice(0, 3)
    .forEach(d => console.log(`  ${d.senderName} → ${d.transferTo}: ₹${d.amount} (${d.paymentDoneOn})`));

  console.log('\nSample FSE payments:');
  docs.filter(d => d.transferToWhom === "FSE Ground Team").slice(0, 3)
    .forEach(d => console.log(`  ${d.senderName} → ${d.transferTo}: ₹${d.amount} (${d.paymentDoneOn})`));

  // ── MongoDB ───────────────────────────────────────────────────────────────
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const existing = await db.collection('TideBT_Payments').countDocuments();
  console.log(`\nExisting records in TideBT_Payments: ${existing}`);

  // ── SAFE SYNC: never delete admin-panel or tl-panel entries ──────────────
  // Sheet sync uses a fingerprint (senderName + transferTo + amount + date rounded to minute)
  // to upsert — so re-syncing won't create duplicates.
  // Only 'pt-sheet-sync' source records are managed by this script.
  // Admin-panel / tl-panel records are untouched.

  // Step 1: Remove previous sheet-synced records
  const deleteResult = await db.collection('TideBT_Payments').deleteMany({ source: 'pt-sheet-sync' });
  console.log(`Removed ${deleteResult.deletedCount} old sheet-sync records.`);

  // Step 2: Fetch existing form payments (submitted via TL / Admin dashboard)
  const existingFormPayments = await db.collection('TideBT_Payments').find({
    source: { $ne: 'pt-sheet-sync' }
  }).toArray();

  const formPaymentKeys = new Set();
  existingFormPayments.forEach(p => {
    const fse = (p.transferTo || p.fseName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const amt = Math.abs(parseFloat(p.amount) || 0);
    let dayNum = '';
    if (p.paymentDoneOn) {
      const match = String(p.paymentDoneOn).match(/\d+/);
      if (match) dayNum = match[0];
    }
    if (!dayNum && p.createdAt) {
      const d = new Date(p.createdAt);
      if (!isNaN(d.getTime())) dayNum = String(d.getDate());
    }
    if (fse && amt) {
      formPaymentKeys.add(`${fse}_${amt}_day${dayNum}`);
    }
  });

  // Filter out sheet rows that are ALREADY in formPaymentKeys (submitted via dashboard)
  const filteredDocs = [];
  let skippedDuplicates = 0;

  docs.forEach(d => {
    const fse = (d.transferTo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const amt = Math.abs(parseFloat(d.amount) || 0);
    let dayNum = '';
    if (d.paymentDoneOn) {
      const match = String(d.paymentDoneOn).match(/\d+/);
      if (match) dayNum = match[0];
    }
    if (!dayNum && d.createdAt) {
      const dateObj = new Date(d.createdAt);
      if (!isNaN(dateObj.getTime())) dayNum = String(dateObj.getDate());
    }

    const key = `${fse}_${amt}_day${dayNum}`;
    if (formPaymentKeys.has(key)) {
      skippedDuplicates++;
    } else {
      filteredDocs.push(d);
    }
  });

  if (skippedDuplicates > 0) {
    console.log(`⏩ SKIPPED ${skippedDuplicates} duplicate sheet rows that were ALREADY submitted via Dashboard Forms.`);
  }

  // Step 3: Insert only unique sheet records
  if (filteredDocs.length > 0) {
    await db.collection('TideBT_Payments').insertMany(filteredDocs);
    console.log(`✅ Inserted ${filteredDocs.length} unique records into TideBT_Payments.`);

    const tlCount  = filteredDocs.filter(d => d.transferToWhom === "TL's & Managers").length;
    const fseCount = filteredDocs.length - tlCount;
    console.log(`   TL payments: ${tlCount}, FSE payments: ${fseCount}`);
  }

  // Step 4: Preserved count & clear summary cache
  const preserved = await db.collection('TideBT_Payments').countDocuments({ source: { $ne: 'pt-sheet-sync' } });
  console.log(`✅ Preserved ${preserved} dashboard form records.`);

  const cacheRes = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log(`🧹 Cleared ${cacheRes.deletedCount} cache entries from TideBT_SummaryCache.`);

  await mongoose.connection.close();
  console.log('\nDone! ✅');
  console.log('⚠️  Cache will be auto-busted on next usage-summary request, or bust manually:');
  console.log('   POST /api/fse/cache/bust');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
