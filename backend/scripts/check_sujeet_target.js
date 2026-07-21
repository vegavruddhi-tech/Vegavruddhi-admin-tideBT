require('dotenv').config();
const { MongoClient } = require('mongodb');
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');
  const targets = await db.collection('TideBT_Targets').find({
    targetFor: { $regex: /sujeet/i },
    month: 'July',
    year: 2026
  }).toArray();
  console.log('Sujeet targets for July 2026:', targets.length);
  targets.forEach(t => console.log(JSON.stringify({ id: t._id, targetFor: t.targetFor, btTarget: t.btTarget, rpTarget: t.rpTarget, month: t.month, year: t.year })));
  await c.close();
}
run().catch(console.error);
