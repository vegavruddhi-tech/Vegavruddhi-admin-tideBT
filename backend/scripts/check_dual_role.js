require('dotenv').config();
const { MongoClient } = require('mongodb');
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');

  const all = await db.collection('TideBT_Access').find({ hasTideBTAccess: true }).toArray();
  const fseNames = new Set(all.map(a => (a.fseName || '').trim().toLowerCase()).filter(Boolean));
  const tlNames  = new Set(all.map(a => (a.tlName  || '').trim().toLowerCase()).filter(Boolean));

  // People who appear as BOTH fseName and tlName
  const dualRole = [...fseNames].filter(n => tlNames.has(n));
  console.log(`\nDual-role people (both TL and FSE): ${dualRole.length}`);
  dualRole.forEach(n => {
    const asFSE = all.find(a => (a.fseName||'').trim().toLowerCase() === n);
    const asTL  = all.find(a => (a.tlName ||'').trim().toLowerCase() === n);
    console.log(`  "${n}" → fseName: "${asFSE?.fseName}" under TL: "${asFSE?.tlName}" | tlName: "${asTL?.tlName}"`);
  });

  await c.close();
}
run().catch(console.error);
