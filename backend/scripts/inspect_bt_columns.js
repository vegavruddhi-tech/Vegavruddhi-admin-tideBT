const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;
  
  const doc = await db.collection('BT_TL_CONNECT JUNE').findOne({
    $or: [
      { upiAmount: { $exists: true } },
      { withdrawAmount: { $exists: true } },
      { UPI_Amount: { $exists: true } }
    ]
  });
  console.log('--- BT_TL_CONNECT JUNE Sample with UPI Amount ---');
  if (doc) {
    console.log(JSON.stringify(doc, null, 2));
  } else {
    const first = await db.collection('BT_TL_CONNECT JUNE').findOne();
    console.log('No UPI Amount docs found. First doc keys:');
    console.log(JSON.stringify(first ? Object.keys(first) : 'empty', null, 2));
  }
  await mongoose.connection.close();
}
run();
