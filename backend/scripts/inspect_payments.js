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

    // 1. Shimon Masih Payments
    console.log('--- Shimon Masih Payments ---');
    const shimonPayments = await db.collection('TideBT_Payments').find({
      transferTo: /shimon/i
    }).toArray();
    console.log(`Found ${shimonPayments.length} payments:`);
    shimonPayments.forEach(p => {
      console.log(`  - amount: ${p.amount}, createdAt: ${p.createdAt}, transferToWhom: ${p.transferToWhom}`);
    });

    // 2. Daya Shankar Payments
    console.log('\n--- Daya Shankar Payments ---');
    const dayaPayments = await db.collection('TideBT_Payments').find({
      transferTo: /daya/i
    }).toArray();
    console.log(`Found ${dayaPayments.length} payments:`);
    dayaPayments.forEach(p => {
      console.log(`  - amount: ${p.amount}, createdAt: ${p.createdAt}, transferToWhom: ${p.transferToWhom}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

run();
