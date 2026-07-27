/**
 * Remove duplicate fund entries — dashboard entries that already exist in sheet sync
 * 
 * Logic: If an admin-panel / tl-panel entry has exact same
 *   senderName + transferTo + amount + paymentDoneOn
 * as a pt-sheet-sync entry → it's a duplicate, delete the dashboard one
 * 
 * DRY RUN first (set DRY_RUN=true), then set false to actually delete
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const DRY_RUN = false; // Change to false to actually delete

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  // Get all sheet-sync entries as a Set of fingerprints
  const sheetEntries = await db.collection('TideBT_Payments').find(
    { source: 'pt-sheet-sync' },
    { projection: { senderName: 1, transferTo: 1, amount: 1, paymentDoneOn: 1 } }
  ).toArray();

  const sheetFingerprints = new Set(
    sheetEntries.map(e =>
      `${(e.senderName || '').toLowerCase().trim()}|${(e.transferTo || '').toLowerCase().trim()}|${e.amount}|${(e.paymentDoneOn || '').trim()}`
    )
  );

  console.log(`Sheet entries (pt-sheet-sync): ${sheetEntries.length}`);

  // Get dashboard entries
  const dashEntries = await db.collection('TideBT_Payments').find(
    { source: { $in: ['admin-panel', 'tl-panel'] } },
    { projection: { _id: 1, senderName: 1, transferTo: 1, amount: 1, paymentDoneOn: 1, source: 1, createdAt: 1 } }
  ).toArray();

  console.log(`Dashboard entries (admin-panel + tl-panel): ${dashEntries.length}`);

  // Find duplicates
  const duplicates = dashEntries.filter(e => {
    const fp = `${(e.senderName || '').toLowerCase().trim()}|${(e.transferTo || '').toLowerCase().trim()}|${e.amount}|${(e.paymentDoneOn || '').trim()}`;
    return sheetFingerprints.has(fp);
  });

  console.log(`\nDuplicates found (dashboard entries that match sheet): ${duplicates.length}`);
  
  if (duplicates.length === 0) {
    console.log('No duplicates to remove. ✅');
    await mongoose.connection.close();
    return;
  }

  console.log('\nDuplicate entries:');
  duplicates.forEach(d => {
    console.log(`  [${d.source}] ${d.senderName} → ${d.transferTo} | ₹${d.amount} | ${d.paymentDoneOn} | ${d.createdAt?.toISOString?.()?.slice(0,10)}`);
  });

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no changes made.');
    console.log('   Set DRY_RUN = false in script to actually delete these entries.');
  } else {
    const ids = duplicates.map(d => d._id);
    const result = await db.collection('TideBT_Payments').deleteMany({ _id: { $in: ids } });
    console.log(`\n✅ Deleted ${result.deletedCount} duplicate dashboard entries.`);
  }

  await mongoose.connection.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
