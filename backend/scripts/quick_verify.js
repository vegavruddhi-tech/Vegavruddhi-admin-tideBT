require('dotenv').config();
const { MongoClient } = require('mongodb');
const MONTHS = ['January','February','March','April','May','June','July'];

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('CompanyDB');

  const allPayments = await db.collection('TideBT_Payments').find({}).toArray();
  const accessList  = await db.collection('TideBT_Access').find({}).toArray();

  const fseNameSet = new Set(accessList.map(a=>(a.fseName||'').trim()).filter(Boolean));
  const tlNameSet  = new Set(accessList.map(a=>(a.tlName||'').trim()).filter(Boolean));

  const SKIP = new Set(['admin','accountant','vv']);

  // Build isTLMap using behavioral detection
  const isTLMap = {};
  for (const n of tlNameSet) isTLMap[n.toLowerCase()] = true;
  allPayments.forEach(p => {
    const s=(p.senderName||'').trim().toLowerCase();
    const r=(p.transferTo||'').trim().toLowerCase();
    if (!s||!r||s===r||SKIP.has(s)) return;
    isTLMap[s] = true;
  });

  // Check Niteesh
  const name = 'niteesh kumar saroj';
  console.log(`Is "${name}" detected as TL? ${isTLMap[name] === true ? 'YES ✅' : 'NO ❌'}`);

  // Show all behavioral TLs not in TideBT_Access tlNameSet
  const extraTLs = Object.keys(isTLMap).filter(n => !tlNameSet.has(n) && !([...tlNameSet].map(t=>t.toLowerCase()).includes(n)));
  console.log('\nBehavioral TLs NOT in TideBT_Access.tlName:');
  extraTLs.forEach(n => {
    const isAlsoFSE = fseNameSet.has(n) || [...fseNameSet].some(f=>f.toLowerCase()===n);
    // Total sent by this person
    const sent = allPayments.filter(p=>(p.senderName||'').trim().toLowerCase()===n&&(p.transferTo||'').trim().toLowerCase()!==n&&!SKIP.has((p.senderName||'').trim().toLowerCase())).reduce((s,p)=>s+(p.amount||0),0);
    // Total received
    const rcvd = allPayments.filter(p=>(p.transferTo||'').trim().toLowerCase()===n).reduce((s,p)=>s+(p.amount||0),0);
    if (Math.abs(sent) > 10000 || Math.abs(rcvd) > 10000)
      console.log(`  ${n} | alsoFSE:${isAlsoFSE} | received:₹${rcvd.toLocaleString()} | sent:₹${sent.toLocaleString()}`);
  });

  // Quick carry forward for Niteesh (no BT data, just fund flow)
  console.log('\nNiteesh carry forward (fund flow only, no BT deduction):');
  let bal = 0;
  const pastMonths = MONTHS.slice(0,6);
  for (const m of pastMonths) {
    const rcvd = allPayments.filter(p=>{
      if(!p.createdAt)return false;
      const d=new Date(p.createdAt);
      return d.getFullYear()===2026&&MONTHS[d.getMonth()]===m&&(p.transferTo||'').trim().toLowerCase()===name;
    }).reduce((s,p)=>s+(p.amount||0),0);
    const sent = allPayments.filter(p=>{
      if(!p.createdAt)return false;
      const d=new Date(p.createdAt);
      return d.getFullYear()===2026&&MONTHS[d.getMonth()]===m&&
             (p.senderName||'').trim().toLowerCase()===name&&
             (p.transferTo||'').trim().toLowerCase()!==name;
    }).reduce((s,p)=>s+(p.amount||0),0);
    if (rcvd||sent) { bal=Math.max(0,bal+rcvd-sent); console.log(`  ${m}: rcvd=₹${rcvd.toLocaleString()} sent=₹${sent.toLocaleString()} bal=₹${bal.toLocaleString()}`); }
  }
  console.log(`  Carry forward: ₹${bal.toLocaleString()}`);

  await client.close();
}
run().catch(console.error);
