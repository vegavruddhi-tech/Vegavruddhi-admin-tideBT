require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;
  const all = (await db.listCollections().toArray()).map(c => c.name);
  const bt = all.filter(c => c.toUpperCase().includes('BT_TL_CONNECT'));
  console.log('BT_TL_CONNECT collections in MongoDB:');
  bt.forEach(c => console.log(' ', c));
  if (bt.length === 0) console.log('  (none found)');
  await mongoose.connection.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
