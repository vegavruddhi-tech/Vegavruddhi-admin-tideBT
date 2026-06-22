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

    // Fetch a couple of documents for Daya Shankar in full
    const docs = await db.collection('TideBT_RewardPass').find({
      employeeName: 'Daya Shankar',
      totalBTAmount: { $gt: 10000 }
    }).limit(2).toArray();

    console.log('--- Sample Documents in Full Details ---');
    console.log(JSON.stringify(docs, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

run();
