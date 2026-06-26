const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  // 1. May Collection info
  const mayCol = 'BT_TL_CONNECT MAY';
  const mayCount = await db.collection(mayCol).countDocuments();
  console.log(`\nMay Collection: "${mayCol}" - total docs: ${mayCount}`);

  // 2. June Collection info
  const juneCol = 'BT_TL_CONNECT JUNE';
  const juneCount = await db.collection(juneCol).countDocuments();
  console.log(`June Collection: "${juneCol}" - total docs: ${juneCount}`);

  // 3. Sample May Doc
  if (mayCount > 0) {
    const maySample = await db.collection(mayCol).findOne({});
    console.log('\n--- MAY DOCUMENT SAMPLE ---');
    console.log(JSON.stringify(maySample, null, 2));
  }

  // 4. Sample June Doc
  if (juneCount > 0) {
    const juneSample = await db.collection(juneCol).findOne({});
    console.log('\n--- JUNE DOCUMENT SAMPLE ---');
    console.log(JSON.stringify(juneSample, null, 2));
  }

  // 5. Compare field mappings and intersection with bt_master
  const masterNums = await db.collection('bt_master').distinct('merchantNumber');
  console.log(`\nTotal unique merchant numbers in bt_master: ${masterNums.length}`);

  if (mayCount > 0) {
    const mayNums = await db.collection(mayCol).distinct('merchantNumber');
    const mayNumsAlt = await db.collection(mayCol).distinct('number');
    const mayIntersection = masterNums.filter(n => mayNums.includes(n) || mayNumsAlt.includes(n));
    console.log(`May unique merchantNumbers: ${mayNums.length}, unique number: ${mayNumsAlt.length}`);
    console.log(`May Intersection with bt_master: ${mayIntersection.length}`);
  }

  if (juneCount > 0) {
    const juneNums = await db.collection(juneCol).distinct('merchantNumber');
    const juneNumsAlt = await db.collection(juneCol).distinct('number');
    const juneIntersection = masterNums.filter(n => juneNums.includes(n) || juneNumsAlt.includes(n));
    console.log(`June unique merchantNumbers: ${juneNums.length}, unique number: ${juneNumsAlt.length}`);
    console.log(`June Intersection with bt_master: ${juneIntersection.length}`);
  }

  await mongoose.connection.close();
  console.log('\nMongoDB connection closed.');
}

run().catch(err => {
  console.error('Error running comparison:', err);
  process.exit(1);
});
