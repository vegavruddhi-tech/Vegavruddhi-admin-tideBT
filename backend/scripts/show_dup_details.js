require('dotenv').config();
const { MongoClient } = require('mongodb');
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');

  const docs = await db.collection('BT_TL_CONNECT JULY').find(
    {}, { projection: { merchantNumber: 1, stage3: 1, lead: 1, Lead: 1, teamLeadName: 1, _rowIndex: 1 } }
  ).toArray();

  const byNum = {};
  docs.forEach(d => {
    const n = (d.merchantNumber || '').trim();
    if (!n) return;
    if (!byNum[n]) byNum[n] = [];
    byNum[n].push({ stage3: d.stage3 || 0, fse: d.lead || d.Lead || '–', tl: d.teamLeadName || '–', row: d._rowIndex });
  });

  const dupes = Object.entries(byNum).filter(([n, arr]) => arr.length > 1 && arr.some(r => r.stage3 > 0));
  console.log(`Duplicate numbers with BT > 0: ${dupes.length}`);
  console.log('\nFirst 20:');
  dupes.slice(0, 20).forEach(([num, rows]) => {
    console.log(`\n  Number: ${num}`);
    rows.forEach(r => console.log(`    Row ${r.row}: FSE=${r.fse} | TL=${r.tl} | BT=₹${r.stage3.toLocaleString()}`));
  });

  // Summary by TL — which TL has most duplicates
  const tlDupCount = {};
  dupes.forEach(([num, rows]) => {
    rows.forEach(r => {
      tlDupCount[r.tl] = (tlDupCount[r.tl] || 0) + 1;
    });
  });
  console.log('\nDuplicate rows by TL:');
  Object.entries(tlDupCount).sort((a,b)=>b[1]-a[1]).forEach(([tl, cnt]) => console.log(`  ${tl}: ${cnt} rows`));

  await c.close();
}
run().catch(console.error);
