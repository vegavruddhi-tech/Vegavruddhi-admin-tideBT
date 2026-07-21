/**
 * Fix TL name: "Rohit Kumar" → "Rohit" in TeamLeads collection
 * This makes it match the fund sheet name so payments are correctly attributed.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('CompanyDB');

  // Check current name
  const current = await db.collection('TeamLeads').findOne({ name: { $regex: /rohit/i } });
  console.log('Current TL record:', current ? { name: current.name, email: current.email } : 'NOT FOUND');

  if (!current) {
    console.log('No TL with "Rohit" in name found. Exiting.');
    await c.close();
    return;
  }

  if (current.name === 'Rohit') {
    console.log('Name is already "Rohit". No change needed.');
    await c.close();
    return;
  }

  // Update name to "Rohit"
  const result = await db.collection('TeamLeads').updateOne(
    { _id: current._id },
    { $set: { name: 'Rohit' } }
  );
  console.log(`✅ Updated "${current.name}" → "Rohit" (modified: ${result.modifiedCount})`);

  // Also update TideBT_Payments where senderName = "Rohit Kumar" → "Rohit"
  const payments = await db.collection('TideBT_Payments').updateMany(
    { senderName: { $regex: /^rohit kumar$/i } },
    { $set: { senderName: 'Rohit' } }
  );
  console.log(`✅ Updated TideBT_Payments senderName: ${payments.modifiedCount} records`);

  // Clear summary cache
  const cache = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log(`🗑️  Summary cache cleared: ${cache.deletedCount} entries`);

  await c.close();
  console.log('Done.');
}

run().catch(console.error);
