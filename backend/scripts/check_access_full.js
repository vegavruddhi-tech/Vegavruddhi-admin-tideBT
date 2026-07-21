require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');

  // Show ALL TideBT_Access records for Rohit
  const rohitDocs = await db.collection('TideBT_Access').find({ tlName: 'Rohit' }).toArray();
  console.log(`\nTideBT_Access records where tlName = "Rohit" (${rohitDocs.length} docs):`);
  rohitDocs.forEach(d => console.log(`  fseName: "${d.fseName}" | tlName: "${d.tlName}"`));

  // Show ALL distinct tlName values
  const allTLs = await db.collection('TideBT_Access').distinct('tlName');
  console.log('\nAll distinct tlName values in TideBT_Access:', allTLs);

  // Show first 5 docs raw to see full structure
  const sample = await db.collection('TideBT_Access').find({}).limit(5).toArray();
  console.log('\nSample raw docs:');
  sample.forEach(d => console.log(JSON.stringify({ tlName: d.tlName, fseName: d.fseName, hasTideBTAccess: d.hasTideBTAccess })));

  client.close();
}).catch(e => console.error(e.message));
