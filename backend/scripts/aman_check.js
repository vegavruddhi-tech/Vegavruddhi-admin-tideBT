require('dotenv').config();
const { MongoClient } = require('mongodb');
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');

  // Aman Sharma merchants in bt_master
  const master = await db.collection('bt_master').find(
    { fseName: { $regex: /aman.sharma/i } },
    { projection: { merchantNumber: 1, merchantName: 1 } }
  ).toArray();
  console.log('bt_master Aman Sharma merchants:', master.length);
  const nums = master.map(m => m.merchantNumber).filter(Boolean);
  console.log('Sample numbers:', nums.slice(0, 5));

  // Check in July
  if (nums.length > 0) {
    const july = await db.collection('BT_TL_CONNECT JULY').find(
      { merchantNumber: { $in: nums } },
      { projection: { merchantNumber: 1, stage3: 1, passLive: 1, lead: 1 } }
    ).toArray();
    console.log('\nFound in BT_TL_CONNECT JULY:', july.length, 'of', nums.length);
    july.slice(0, 3).forEach(d => console.log(' ', d.merchantNumber, 'stage3:', d.stage3, 'live:', d.passLive, 'lead:', d.lead));
    const missing = nums.filter(n => !july.find(d => d.merchantNumber === n));
    console.log('Missing from July:', missing.length);
  }

  // Check how "Aman Sharma" appears as lead in July
  const byLead = await db.collection('BT_TL_CONNECT JULY').find(
    { lead: { $regex: /aman/i } },
    { projection: { lead: 1, merchantNumber: 1, stage3: 1 } }
  ).limit(5).toArray();
  console.log('\nJuly docs with lead "aman":', byLead.length);
  byLead.forEach(d => console.log(' lead:', d.lead, '| num:', d.merchantNumber, '| s3:', d.stage3));

  await c.close();
}
run().catch(console.error);
