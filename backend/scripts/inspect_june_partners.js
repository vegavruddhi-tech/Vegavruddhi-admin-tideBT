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
    console.log('No documents found.');
    await mongoose.connection.close();
    return;
  }

  // 1. Get distinct partnerName
  const partners = await db.collection(collectionName).distinct('partnerName');
  console.log('\nDistinct partnerName values:', partners);

  // 2. Get distinct teamLeadName / tlName
  const tlNames1 = await db.collection(collectionName).distinct('teamLeadName');
  const tlNames2 = await db.collection(collectionName).distinct('tlName');
  console.log('\nDistinct teamLeadName values:', tlNames1);
  console.log('Distinct tlName values:', tlNames2);

  // 3. Print count of documents per partnerName
  console.log('\n--- Documents count per partner ---');
  for (const partner of partners) {
    const count = await db.collection(collectionName).countDocuments({ partnerName: partner });
    console.log(`- "${partner}": ${count} docs`);
  }

  // 4. Sample doc where stage3 > 0 or has value
  const sampleStage3 = await db.collection(collectionName).findOne({
    stage3: { $exists: true, $ne: '0', $ne: '' }
  });
  if (sampleStage3) {
    console.log('\n--- SAMPLE DOC WITH STAGE-3 > 0 ---');
    console.log(JSON.stringify(sampleStage3, null, 2));
  } else {
    console.log('\n❌ No documents found with stage3 > 0');
  }

  await mongoose.connection.close();
  console.log('\nMongoDB connection closed.');
}

run().catch(console.error);
