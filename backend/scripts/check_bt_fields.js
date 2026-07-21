require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');
  const col = 'BT_TL_CONNECT JULY';

  const total = await db.collection(col).countDocuments();
  console.log('Total docs in', col, ':', total);

  // Docs with yesterdaysStage3 > 0
  const withYest = await db.collection(col).find({ yesterdaysStage3: { $gt: 0 } }).limit(5).toArray();
  console.log('\nDocs with yesterdaysStage3 > 0:', withYest.length);
  withYest.forEach(d => console.log('  TL:', d.teamLeadName, '| merchantNumber:', d.merchantNumber, '| yesterdaysStage3:', d.yesterdaysStage3, '| stage3:', d.stage3));

  // Grand totals via aggregation
  const agg = await db.collection(col).aggregate([
    { $group: { _id: null, totalMTD: { $sum: '$stage3' }, totalFTD: { $sum: '$yesterdaysStage3' } } }
  ]).toArray();
  console.log('\nGrand totals:', agg[0]);

  // Per-TL totals
  const perTL = await db.collection(col).aggregate([
    { $group: { _id: '$teamLeadName', mtdBT: { $sum: '$stage3' }, ftdBT: { $sum: '$yesterdaysStage3' }, rpCount: { $sum: { $cond: [{ $eq: ['$rewardPassPro', 'Active'] }, 1, 0] } } } },
    { $sort: { mtdBT: -1 } }
  ]).toArray();
  console.log('\nPer-TL breakdown:');
  perTL.forEach(t => console.log(`  TL: ${t._id || 'null'} | MTD: ${t.mtdBT} | FTD: ${t.ftdBT} | RP: ${t.rpCount}`));

  client.close();
}).catch(e => console.error(e.message));
