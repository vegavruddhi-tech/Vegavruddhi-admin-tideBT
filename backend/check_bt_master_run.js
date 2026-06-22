const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:\\VegaProject\\Vegavruddhi-admin-tideBT\\backend\\.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const count = await db.collection('bt_master').countDocuments();
  console.log('Total bt_master:', count);

  const sample = await db.collection('bt_master').findOne({});
  console.log('Sample:', JSON.stringify(sample, null, 2));

  // Check Sujeet Saroj
  const sujeet = await db.collection('bt_master').find({ fseName: /sujeet/i }).limit(3).toArray();
  console.log('\nSujeet records:', sujeet.length);
  sujeet.forEach(s => console.log(JSON.stringify({ merchantName: s.merchantName, merchantNumber: s.merchantNumber, fseName: s.fseName, fseEmail: s.fseEmail })));

  // Distinct fseName values (first 20)
  const fseNames = await db.collection('bt_master').distinct('fseName');
  console.log('\nDistinct fseName values (first 20):', fseNames.slice(0,20));

  // Check Pankaj Kumar
  const pankaj = await db.collection('bt_master').find({ fseName: /pankaj kumar/i }).limit(3).toArray();
  console.log('\nPankaj Kumar records:', pankaj.length);
  pankaj.forEach(p => console.log(JSON.stringify({ merchantName: p.merchantName, merchantNumber: p.merchantNumber, fseName: p.fseName })));

  await mongoose.connection.close();
}
run().catch(console.error);
