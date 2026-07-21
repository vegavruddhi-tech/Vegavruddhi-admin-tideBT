/**
 * Fix TL name mismatches between TeamLeads collection (portal)
 * and TideBT_Access tlName (fund sheet canonical name).
 *
 * Mismatches found:
 *   "Faisal Khan"        → "Faisal"
 *   "Ashwani Kumar"      → "Ashwani"
 *   "Dheeraj Anand"      → "Dheeraj"
 *   "vijay kr"           → "Vijay"
 *   "Vijay Kumar "       → "Vijay"
 *
 * NOTE: Two portal entries map to same sheet name "Vijay" —
 * vijay kr (tenguriyavijay86@gmail.com) and Vijay Kumar (vijaysharma1551992@gmail.com).
 * Both will be updated to "Vijay".
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const FIXES = [
  { portalName: 'Faisal Khan',           sheetName: 'Faisal'   },
  { portalName: 'Ashwani Kumar',         sheetName: 'Ashwani'  },
  { portalName: 'Dheeraj Anand',         sheetName: 'Dheeraj'  },
  { portalName: 'vijay kr',              sheetName: 'Vijay'    },
  { portalName: 'Vijay Kumar ',          sheetName: 'Vijay'    },  // trailing space
];

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');
  const col = db.collection('TeamLeads');

  console.log('Fixing TL name mismatches...\n');

  for (const fix of FIXES) {
    const result = await col.updateOne(
      { name: fix.portalName },
      { $set: { name: fix.sheetName } }
    );
    if (result.matchedCount === 0) {
      console.log(`  ⚠️  Not found in DB: "${fix.portalName}"`);
    } else if (result.modifiedCount === 0) {
      console.log(`  ℹ️  Already correct (no change): "${fix.portalName}"`);
    } else {
      console.log(`  ✅  Updated: "${fix.portalName}" → "${fix.sheetName}"`);
    }
  }

  // Verify final state
  console.log('\n=== Verification: TL portal names after fix ===');
  const tls = await col.find({}, { projection: { name: 1, email: 1 } }).toArray();
  const access = (await db.collection('TideBT_Access').distinct('tlName')).map(n => n.trim().toLowerCase());
  tls.forEach(t => {
    const match = access.includes(t.name.trim().toLowerCase());
    console.log(`  ${match ? '✅' : '⚠️ (no TideBT access)'} "${t.name}" (${t.email})`);
  });

  await c.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
