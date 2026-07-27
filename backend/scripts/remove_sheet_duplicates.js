require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const allSheet = await db.collection('TideBT_Payments').find(
    { source: 'pt-sheet-sync' },
    { projection: { _id: 1, senderName: 1, transferTo: 1, amount: 1, paymentDoneOn: 1, createdAt: 1 } }
  ).sort({ createdAt: 1 }).toArray();

  console.log(`Total pt-sheet-sync entries: ${allSheet.length}`);

  const seen = new Map();
  const toDelete = [];

  allSheet.forEach(e => {
    const fp = `${(e.senderName||'').toLowerCase().trim()}|${(e.transferTo||'').toLowerCase().trim()}|${e.amount}|${(e.paymentDoneOn||'').trim()}`;
    if (seen.has(fp)) {
      toDelete.push(e._id);
    } else {
      seen.set(fp, e._id);
    }
  });

  console.log(`Internal duplicates to remove: ${toDelete.length}`);
  if (toDelete.length === 0) { console.log('None. ✅'); await mongoose.connection.close(); return; }

  // Batch delete 500 at a time
  let deleted = 0;
  const batchSize = 500;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const r = await db.collection('TideBT_Payments').deleteMany({ _id: { $in: batch } });
    deleted += r.deletedCount;
    console.log(`Deleted batch ${Math.floor(i/batchSize)+1}: ${deleted} total so far`);
  }

  console.log(`\n✅ Done. Removed ${deleted} duplicates.`);
  const remaining = await db.collection('TideBT_Payments').countDocuments({ source: 'pt-sheet-sync' });
  console.log(`Remaining: ${remaining}`);

  await mongoose.connection.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
