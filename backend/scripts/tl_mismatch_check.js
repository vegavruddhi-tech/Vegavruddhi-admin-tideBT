require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');

  const tls     = await db.collection('TeamLeads').find({}, { projection: { name: 1, email: 1 } }).toArray();
  const access  = await db.collection('TideBT_Access').distinct('tlName');
  const cleaned = access.map(n => n.trim()).filter(Boolean);

  console.log('\n=== TeamLeads portal names ===');
  tls.forEach(t => console.log(`  "${t.name}"  (${t.email})`));

  console.log('\n=== TideBT_Access tlNames ===');
  cleaned.forEach(n => console.log(`  "${n}"`));

  console.log('\n=== MISMATCHES (portal name != sheet name) ===');
  let ok = true;
  tls.forEach(t => {
    const p = t.name.trim().toLowerCase();
    const exact = cleaned.find(n => n.toLowerCase() === p);
    if (!exact) {
      ok = false;
      const partial = cleaned.find(n => n.toLowerCase().includes(p) || p.includes(n.toLowerCase()));
      console.log(`  ❌  portal: "${t.name}"  →  sheet match: "${partial || 'NOT FOUND'}"`);
    } else {
      console.log(`  ✅  "${t.name}" matches sheet`);
    }
  });
  if (ok) console.log('  All TL names match!');

  await c.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
