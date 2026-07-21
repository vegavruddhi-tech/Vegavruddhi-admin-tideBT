require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');

  // 1. TideBT_Access — what TLs and FSEs exist
  const accessDocs = await db.collection('TideBT_Access').find({}).toArray();
  const tlFSEMap = {};
  const fseToTL  = {};
  accessDocs.forEach(a => {
    const tl  = (a.tlName  || '').trim();
    const fse = (a.fseName || '').trim();
    if (!tl) return;
    if (!tlFSEMap[tl]) tlFSEMap[tl] = new Set();
    if (fse) { tlFSEMap[tl].add(fse); fseToTL[fse.toLowerCase()] = tl; }
  });
  console.log('TLs in TideBT_Access:', Object.keys(tlFSEMap));
  console.log('\nFSE → TL map (first 20):');
  Object.entries(fseToTL).slice(0, 20).forEach(([f, t]) => console.log(`  "${f}" → "${t}"`));

  // 2. bt_master — sample fseName values
  const masterSample = await db.collection('bt_master').find({}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }).limit(10).toArray();
  console.log('\nbt_master sample fseName values:');
  masterSample.forEach(m => console.log(`  num: ${m.merchantNumber} | fseName: "${m.fseName}"`));

  // 3. Check per-TL BT using the same mapping as the report
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allTLNames = Object.keys(tlFSEMap);
  const masterDocs = await db.collection('bt_master').find({}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }).toArray();
  const numToFse = {};
  masterDocs.forEach(m => {
    const num = (m.merchantNumber || '').trim();
    const fse = (m.fseName || '').trim();
    if (num && fse) numToFse[num] = fse;
  });
  const allNums = [...new Set(masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean))];

  const btDocs = await db.collection('BT_TL_CONNECT JULY').find(
    {}, { projection: { merchantNumber: 1, stage3: 1, yesterdaysStage3: 1, rewardPassPro: 1, _id: 0 } }
  ).toArray();

  const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
  const tlStats = {};
  allTLNames.forEach(tl => { tlStats[tl] = { mtdBT: 0, ftdBT: 0, rp: 0, matched: 0, unmatched: 0 }; });
  let totalUnmapped = 0;

  btDocs.forEach(r => {
    const num = (r.merchantNumber || '').trim();
    if (!allNums.includes(num)) { totalUnmapped++; return; }
    const rawFse = numToFse[num];
    if (!rawFse) return;
    const tlName = fseToTL[rawFse.toLowerCase()]
      || allTLNames.find(tl => [...tlFSEMap[tl]].some(f => new RegExp(`^\\s*${escape(f)}\\s*\\d*\\s*$`, 'i').test(rawFse)));
    if (!tlName) { totalUnmapped++; return; }
    tlStats[tlName].mtdBT += parseNum(r.stage3);
    tlStats[tlName].ftdBT += parseNum(r.yesterdaysStage3 || 0);
    if ((r.rewardPassPro || '').toLowerCase() === 'active') tlStats[tlName].rp++;
    tlStats[tlName].matched++;
  });

  console.log('\nPer-TL report data:');
  allTLNames.forEach(tl => {
    const s = tlStats[tl];
    if (s.matched > 0 || s.mtdBT > 0)
      console.log(`  ${tl}: MTD=₹${s.mtdBT.toLocaleString('en-IN')} | FTD=₹${s.ftdBT.toLocaleString('en-IN')} | RP=${s.rp} | matched=${s.matched}`);
  });
  console.log(`\nTotal unmapped merchants: ${totalUnmapped}`);

  client.close();
}).catch(e => console.error(e.message));
