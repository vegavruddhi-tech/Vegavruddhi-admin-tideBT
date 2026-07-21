require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const tlEmail    = 'rohitkumar952870@gmail.com';
  const portalName = 'Rohit Kumar';
  const firstWord  = 'Rohit';

  console.log('=== Simulating login/profile $or lookup for Rohit ===\n');

  const step1 = await db.collection('TideBT_Access').findOne({
    $or: [
      { tlEmail: tlEmail.toLowerCase() },
      { tlName: { $regex: new RegExp(`^\\s*${escape(portalName)}\\s*$`, 'i') } },
      { tlName: { $regex: new RegExp(`^\\s*${escape(firstWord)}\\s*$`, 'i') } },
    ]
  });
  console.log('$or result:', step1 ? { tlName: step1.tlName, fseName: step1.fseName, tlEmail: step1.tlEmail, fseEmail: step1.fseEmail } : 'null');

  const resolvedName = step1?.tlName || portalName;
  console.log('\nResolved name used for all subsequent queries:', resolvedName);

  const fses = await db.collection('TideBT_Access').find({
    tlName: { $regex: new RegExp(`^\\s*${escape(resolvedName)}\\s*$`, 'i') },
    hasTideBTAccess: true
  }).toArray();
  console.log('\nFSEs loaded for this TL:', fses.map(f => f.fseName));

  client.close();
}).catch(e => console.error(e.message));
