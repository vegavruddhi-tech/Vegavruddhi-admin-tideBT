const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'CompanyDB'
    });
    
    const db = mongoose.connection.db;
    const sample = await db.collection('TideBT_RewardPass').find({}).limit(5).toArray();
    
    console.log('--- TideBT_RewardPass sample documents ---');
    sample.forEach((doc, idx) => {
      console.log(`Document ${idx + 1}:`);
      console.log(`  employeeName:  ${doc.employeeName}`);
      console.log(`  dateOfWorking: ${doc.dateOfWorking} (type: ${typeof doc.dateOfWorking}, isDate: ${doc.dateOfWorking instanceof Date})`);
      console.log(`  createdAt:     ${doc.createdAt} (type: ${typeof doc.createdAt}, isDate: ${doc.createdAt instanceof Date})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

run();
