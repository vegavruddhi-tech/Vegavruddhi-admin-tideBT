require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  // Bust FSE/TL overview cache (ApiCache collection)
  const r1 = await db.collection('ApiCache').deleteMany({});
  console.log(`✅ ApiCache cleared — ${r1.deletedCount} entries removed`);

  // Bust fund transfer summary cache
  const r2 = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log(`✅ TideBT_SummaryCache cleared — ${r2.deletedCount} entries removed`);

  await mongoose.connection.close();
  console.log('\nDone! Dashboard will load fresh data on next request.');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
