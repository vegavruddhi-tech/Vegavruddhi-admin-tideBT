require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const master = await db.collection('bt_master').find(
    { fseName: { $regex: /^vikki/i } },
    { projection: { merchantNumber: 1 } }
  ).toArray();
  const nums = [...new Set(master.map(m => m.merchantNumber.trim()))];

  const btDocs = await db.collection('BT_TL_CONNECT JULY').find(
    { merchantNumber: { $in: nums } },
    { projection: { merchantNumber: 1, stage3: 1, rewardPassPro: 1, priorityPassPro: 1 } }
  ).toArray();

  let totalBT = 0, rpCount = 0;
  btDocs.forEach(r => {
    const bt = parseFloat(String(r.stage3 || '0').replace(/,/g, '')) || 0;
    totalBT += bt;
    if ((r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active') rpCount++;
  });

  const btFee = Math.round((totalBT > 10000 ? totalBT * 0.015 : 0) * 100) / 100;
  console.log(`\nVikki July 2026 — from MongoDB:`);
  console.log(`  BT: ₹${totalBT.toLocaleString()}`);
  console.log(`  RP: ${rpCount}`);
  console.log(`  Fee: ₹${btFee.toLocaleString()}`);

  // Payments
  const payments = await db.collection('TideBT_Payments').find({
    transferTo: { $regex: /^vikki$/i },
    createdAt: { $gte: new Date('2026-07-01'), $lte: new Date('2026-07-31') }
  }).toArray();
  const received = payments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const deducted = payments.filter(p => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0);
  console.log(`  Received: ₹${received.toLocaleString()}`);
  console.log(`  Deducted: ₹${deducted.toLocaleString()}`);
  console.log(`  Fund Left: ₹${(received - deducted - btFee - rpCount * 2500).toLocaleString()}`);

  await mongoose.connection.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
