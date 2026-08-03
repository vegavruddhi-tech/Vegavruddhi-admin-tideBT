const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkCount() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    const count = await db.collection('TideBT_Payments').countDocuments();
    console.log(`[CHECK] Current document count in TideBT_Payments: ${count}`);

    if (count > 0) {
      const sample = await db.collection('TideBT_Payments').find({}).limit(3).toArray();
      console.log('Sample docs:', JSON.stringify(sample, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err.message);
    process.exit(1);
  }
}

checkCount();
