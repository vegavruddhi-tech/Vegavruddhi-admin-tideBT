require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { cacheInvalidatePattern } = require('../utils/cache');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const r1 = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log(`✅ TideBT_SummaryCache cleared — ${r1.deletedCount} entries`);

  const r2 = await db.collection('ApiCache').deleteMany({});
  console.log(`✅ ApiCache cleared — ${r2.deletedCount} entries`);

  await cacheInvalidatePattern('*');
  console.log('✅ All Redis cache keys cleared!');

  console.log('Done! All panels will load fresh data on next request.');
  await mongoose.connection.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
