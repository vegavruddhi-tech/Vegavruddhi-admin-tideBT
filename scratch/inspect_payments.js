const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, dbName: 'CompanyDB' });
    const db = mongoose.connection.db;

    const count = await db.collection('TideBT_Payments').countDocuments();
    console.log(`Total payments in database: ${count}`);

    if (count > 0) {
      const sample = await db.collection('TideBT_Payments').find({}).limit(10).toArray();
      console.log('Sample payments:');
      console.log(JSON.stringify(sample, null, 2));

      // Let's check unique values/structures of createdAt and paymentDoneOn
      const list = await db.collection('TideBT_Payments').find({}).toArray();
      const stats = {
        hasCreatedAt: 0,
        hasPaymentDoneOn: 0,
        createdAtTypes: {},
        paymentDoneOnTypes: {}
      };
      list.forEach(p => {
        if ('createdAt' in p) {
          stats.hasCreatedAt++;
          const t = typeof p.createdAt === 'object' ? p.createdAt.constructor.name : typeof p.createdAt;
          stats.createdAtTypes[t] = (stats.createdAtTypes[t] || 0) + 1;
        }
        if ('paymentDoneOn' in p) {
          stats.hasPaymentDoneOn++;
          const t = typeof p.paymentDoneOn === 'object' ? p.paymentDoneOn.constructor.name : typeof p.paymentDoneOn;
          stats.paymentDoneOnTypes[t] = (stats.paymentDoneOnTypes[t] || 0) + 1;
        }
      });
      console.log('\nPayment Stats:', stats);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}
run();
