const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'CompanyDB'
    });
    
    const db = mongoose.connection.db;

    // 1. Shimon Masih
    console.log('--- Shimon Masih Reward Passes ---');
    const shimonRPs = await db.collection('TideBT_RewardPass').find({
      employeeName: /shimon/i
    }).toArray();
    
    console.log(`Found ${shimonRPs.length} documents:`);
    shimonRPs.forEach((doc, idx) => {
      console.log(`Document ${idx + 1}:`);
      console.log(`  employeeName:  ${doc.employeeName}`);
      console.log(`  totalRPCount:  ${doc.totalRPCount} (type: ${typeof doc.totalRPCount})`);
      console.log(`  totalBTAmount: ${doc.totalBTAmount} (type: ${typeof doc.totalBTAmount})`);
      console.log(`  dateOfWorking: ${doc.dateOfWorking}`);
      console.log(`  createdAt:     ${doc.createdAt}`);
    });

    // 2. Daya Shankar
    console.log('\n--- Daya Shankar Reward Passes ---');
    const dayaRPs = await db.collection('TideBT_RewardPass').find({
      employeeName: /daya/i
    }).toArray();
    
    console.log(`Found ${dayaRPs.length} documents:`);
    dayaRPs.forEach((doc, idx) => {
      console.log(`Document ${idx + 1}:`);
      console.log(`  employeeName:  ${doc.employeeName}`);
      console.log(`  totalRPCount:  ${doc.totalRPCount}`);
      console.log(`  totalBTAmount: ${doc.totalBTAmount}`);
      console.log(`  dateOfWorking: ${doc.dateOfWorking}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

run();
