require('dotenv').config();
const { MongoClient } = require('mongodb');
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');

  // Check Rohit's sent payments
  const sent = await db.collection('TideBT_Payments').find(
    { senderName: { $regex: /rohit/i } }
  ).sort({ createdAt: -1 }).limit(10).toArray();

  console.log('Rohit sent payments:', sent.length);
  sent.forEach(p => console.log(JSON.stringify({
    sender: p.senderName, to: p.transferTo, amt: p.amount,
    whom: p.transferToWhom, date: p.createdAt
  })));

  // Also check received payments for Rohit
  const recv = await db.collection('TideBT_Payments').find(
    { transferTo: { $regex: /rohit/i } }
  ).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('\nRohit received payments:', recv.length);
  recv.forEach(p => console.log(JSON.stringify({
    sender: p.senderName, to: p.transferTo, amt: p.amount, whom: p.transferToWhom
  })));

  // Clear TL cache
  const r = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log('\nSummary cache cleared:', r.deletedCount);

  await c.close();
}
run().catch(console.error);
