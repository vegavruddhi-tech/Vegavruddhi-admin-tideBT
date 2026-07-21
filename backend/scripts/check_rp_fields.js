require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');
  const col = 'BT_TL_CONNECT JULY';

  // Check todaysStage3 grand total
  const agg = await db.collection(col).aggregate([
    { $group: { _id: null, totalToday: { $sum: '$todaysStage3' }, totalYest: { $sum: '$yesterdaysStage3' }, totalMTD: { $sum: '$stage3' } } }
  ]).toArray();
  console.log('Grand totals:', agg[0]);

  // Sample rewardsPassProActiveDate values
  const rpDates = await db.collection(col).aggregate([
    { $match: { rewardPassPro: 'Active' } },
    { $group: { _id: '$rewardsPassProActiveDate', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();
  console.log('\nrewardsPassProActiveDate sample values:', rpDates);

  client.close();
}).catch(e => console.error(e.message));
