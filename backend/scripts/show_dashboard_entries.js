require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const entries = await db.collection('TideBT_Payments').find(
    { source: { $in: ['admin-panel', 'tl-panel'] }, createdAt: { $gte: new Date('2026-07-01') } },
    { projection: { senderName: 1, transferTo: 1, amount: 1, paymentDoneOn: 1, source: 1, createdAt: 1 } }
  ).sort({ createdAt: 1 }).toArray();

  console.log(`\nDashboard entries in July 2026: ${entries.length}`);
  entries.forEach(e => {
    console.log(`  [${e.source}] ${e.senderName} → ${e.transferTo} | ₹${e.amount} | ${e.paymentDoneOn} | ${e.createdAt?.toISOString?.()?.slice(0,10)}`);
  });

  await mongoose.connection.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
