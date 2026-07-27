require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const total = await db.collection('TideBT_Payments').countDocuments();
  const bySource = await db.collection('TideBT_Payments').aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log(`Total TideBT_Payments: ${total}`);
  console.log('By source:');
  bySource.forEach(s => console.log(`  ${s._id}: ${s.count}`));

  // Check for duplicate pt-sheet-sync entries (same senderName + transferTo + amount + date)
  const dupes = await db.collection('TideBT_Payments').aggregate([
    { $match: { source: 'pt-sheet-sync' } },
    { $group: {
      _id: { senderName: '$senderName', transferTo: '$transferTo', amount: '$amount', paymentDoneOn: '$paymentDoneOn' },
      count: { $sum: 1 }
    }},
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log(`\nDuplicate pt-sheet-sync entries: ${dupes.length}`);
  if (dupes.length > 0) {
    dupes.slice(0, 5).forEach(d => console.log(`  ${JSON.stringify(d._id)} → ${d.count} copies`));
  }

  await mongoose.connection.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
