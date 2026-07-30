const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { cacheInvalidatePattern } = require('./utils/cache');

async function wipePayments() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    const countBefore = await db.collection('TideBT_Payments').countDocuments();
    console.log(`Current records in TideBT_Payments: ${countBefore}`);

    const res = await db.collection('TideBT_Payments').deleteMany({});
    console.log(`✅ Deleted ${res.deletedCount} payment records from TideBT_Payments!`);

    await cacheInvalidatePattern('*');
    console.log('⚡ All Redis and in-memory caches invalidated!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Wipe failed:', err.message);
    process.exit(1);
  }
}

wipePayments();
