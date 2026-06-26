const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const collectionName = 'BT_TL_CONNECT JUNE';
  const total = await db.collection(collectionName).countDocuments();
  console.log(`\nTotal documents in "${collectionName}":`, total);

  if (total === 0) {
    console.log('No documents found in collection.');
    await mongoose.connection.close();
    return;
  }

  // 1. Show a few sample docs
  console.log('\n--- SAMPLE DOCUMENTS (First 3) ---');
  const samples = await db.collection(collectionName).find({}).limit(3).toArray();
  samples.forEach((d, idx) => {
    console.log(`\nDoc ${idx + 1}:`);
    console.log(JSON.stringify(d, null, 2));
  });

  // 2. Check phone number formats in BT_TL_CONNECT JUNE vs bt_master
  console.log('\n--- CHECKING PHONE NUMBER FORMATS ---');
  const sampleWithPhone = await db.collection(collectionName).findOne({
    $or: [
      { merchantNumber: { $exists: true, $ne: '' } },
      { number: { $exists: true, $ne: '' } }
    ]
  });
  
  if (sampleWithPhone) {
    console.log('Sample merchantNumber in BT_TL_CONNECT JUNE:', sampleWithPhone.merchantNumber);
    console.log('Sample number in BT_TL_CONNECT JUNE:', sampleWithPhone.number);
  }

  const masterSample = await db.collection('bt_master').findOne({
    merchantNumber: { $exists: true, $ne: '' }
  });
  if (masterSample) {
    console.log('Sample merchantNumber in bt_master:', masterSample.merchantNumber);
  }

  // 3. Check matching between bt_master and BT_TL_CONNECT JUNE
  const masterNums = await db.collection('bt_master').distinct('merchantNumber');
  console.log(`\nTotal unique merchant numbers in bt_master: ${masterNums.length}`);

  const btNums = await db.collection(collectionName).distinct('merchantNumber');
  console.log(`Total unique merchantNumbers in BT_TL_CONNECT JUNE: ${btNums.length}`);

  const intersection = masterNums.filter(n => btNums.includes(n));
  console.log(`Intersection (numbers present in both): ${intersection.length}`);

  if (intersection.length === 0 && btNums.length > 0 && masterNums.length > 0) {
    console.log('\nChecking why they do not match:');
    console.log('bt_master sample numbers:', masterNums.slice(0, 5));
    console.log('BT_TL_CONNECT JUNE sample numbers:', btNums.slice(0, 5));
  }

  // 4. Check if we have non-zero stage3 values
  const hasStage3 = await db.collection(collectionName).countDocuments({
    $or: [
      { stage3: { $gt: 0 } },
      { 'Stage-3': { $gt: 0 } }
    ]
  });
  console.log(`\nDocuments with Stage-3 > 0: ${hasStage3}`);

  await mongoose.connection.close();
  console.log('\nMongoDB connection closed.');
}

run().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
