require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const sources = await db.collection('TideBT_Payments').aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('\n=== TideBT_Payments — Records by Source ===');
  sources.forEach(s => console.log(`  source: ${JSON.stringify(s._id)}  →  ${s.count} records`));

  const total = await db.collection('TideBT_Payments').countDocuments();
  console.log(`\nTotal: ${total} records`);

  await mongoose.connection.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
