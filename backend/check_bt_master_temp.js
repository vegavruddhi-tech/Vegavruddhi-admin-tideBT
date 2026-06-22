const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:\\VegaProject\\Vegavruddhi-admin-tideBT\\backend\\.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const count = await db.collection('bt_master').countDocuments();
  console.log('Total bt_master records:', count);

  const sample = await db.collection('bt_master').find({}).limit(3).toArray();
  console.log('\nSample docs:');
  sample.forEach(d => console.log(JSON.stringify(d, null, 2)));

  const fseNames = await db.collection('bt_master').distinct('fseName');
  console.log('\nDistinct FSE names (first 20):', fseNames.slice(0, 20));

  // Check Sujeet Saroj
  const sujeet = await db.collection('bt_master').find({ fseName: /sujeet/i }).limit(3).toArray();
  console.log('\nSujeet records:', sujeet.length);
  sujeet.forEach(d => console.log(JSON.stringify({ merchantName: d.merchantName, merchantNumber: d.merchantNumber, fseName: d.fseName, fseEmail: d.fseEmail })));

  // Check how many unique merchant numbers exist per FSE
  const pipeline = [{ $group: { _id: '$fseName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }];
  const byFSE = await db.collection('bt_master').aggregate(pipeline).toArray();
  console.log('\nTop 10 FSEs by merchant count:');
  byFSE.forEach(r => console.log(`  ${r._id}: ${r.count}`));

  await mongoose.connection.close();
}
run().catch(console.error);
