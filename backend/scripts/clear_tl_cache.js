require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');

  // Delete ALL TL-related cache entries so every TL gets fresh data on next load
  const result = await db.collection('TideBT_SummaryCache').deleteMany({
    cacheKey: { $regex: /^TL_/i }
  });
  console.log(`Cleared ${result.deletedCount} TL cache entries from TideBT_SummaryCache`);

  // Show remaining entries
  const remaining = await db.collection('TideBT_SummaryCache').countDocuments();
  console.log(`Remaining cache entries: ${remaining}`);

  client.close();
}).catch(e => console.error(e.message));
