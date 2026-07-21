require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  process.stdout.write('Starting...\n');
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  process.stdout.write('Connected to MongoDB\n');
  const db = c.db('CompanyDB');

  const teamLeads = await db.collection('TeamLeads').find({}, { projection: { name: 1, email: 1 } }).toArray();
  process.stdout.write(`TeamLeads in portal: ${teamLeads.length}\n`);
  teamLeads.forEach(tl => process.stdout.write(`  Portal: "${tl.name}"\n`));

  const accessDocs = await db.collection('TideBT_Access').find({}, { projection: { tlName: 1 } }).toArray();
  const accessTLNames = [...new Set(accessDocs.map(a => (a.tlName||'').trim()).filter(Boolean))];
  process.stdout.write(`\nTideBT_Access tlNames: ${accessTLNames.length}\n`);
  accessTLNames.forEach(n => process.stdout.write(`  Access: "${n}"\n`));

  process.stdout.write('\nMISMATCHES:\n');
  teamLeads.forEach(tl => {
    const exact = accessTLNames.find(n => n.toLowerCase() === tl.name.toLowerCase().trim());
    if (!exact) {
      const partial = accessTLNames.find(n =>
        n.toLowerCase().includes(tl.name.toLowerCase()) ||
        tl.name.toLowerCase().includes(n.toLowerCase())
      );
      process.stdout.write(`  ❌ Portal "${tl.name}" → Access match: "${partial||'NONE'}"\n`);
    } else {
      process.stdout.write(`  ✅ "${tl.name}" matches\n`);
    }
  });

  await c.close();
  process.stdout.write('Done.\n');
}

run().catch(e => process.stdout.write('Error: '+e.message+'\n'));
