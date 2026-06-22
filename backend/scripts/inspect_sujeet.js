const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, dbName: 'CompanyDB' });
    const db = mongoose.connection.db;

    // Check unique months in 'month' field
    const months = await db.collection('TideBT_RewardPass').distinct('month');
    console.log('Unique values in "month" column:', months);

    // Check unique years and months in 'dateOfWorking'
    const list = await db.collection('TideBT_RewardPass').find({}).toArray();
    console.log(`Total documents found in TideBT_RewardPass: ${list.length}`);

    const dateOfWorkingStats = {};
    const createdAtStats = {};

    list.forEach(doc => {
      if (doc.dateOfWorking) {
        const d = new Date(doc.dateOfWorking);
        if (!isNaN(d.getTime())) {
          const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          dateOfWorkingStats[key] = (dateOfWorkingStats[key] || 0) + 1;
        } else {
          dateOfWorkingStats['Invalid Date'] = (dateOfWorkingStats['Invalid Date'] || 0) + 1;
        }
      } else {
        dateOfWorkingStats['Missing'] = (dateOfWorkingStats['Missing'] || 0) + 1;
      }

      if (doc.createdAt) {
        const d = new Date(doc.createdAt);
        if (!isNaN(d.getTime())) {
          const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          createdAtStats[key] = (createdAtStats[key] || 0) + 1;
        }
      }
    });

    console.log('\nBreakdown of "dateOfWorking" field (Month Year):');
    console.log(dateOfWorkingStats);

    console.log('\nBreakdown of "createdAt" field (Month Year):');
    console.log(createdAtStats);

    // Show a sample document with non-empty fields
    const sample = await db.collection('TideBT_RewardPass').findOne({ dateOfWorking: { $exists: true } });
    if (sample) {
      console.log('\nSample Document details:');
      console.log(`- dateOfWorking: ${sample.dateOfWorking} (type: ${typeof sample.dateOfWorking})`);
      console.log(`- month: ${sample.month}`);
      console.log(`- employeeName: ${sample.employeeName}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}
run();
