const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, dbName: 'CompanyDB' });
    const db = mongoose.connection.db;

    // Check TLs
    console.log('--- TLs in TeamLeads collection ---');
    const tls = await db.collection('TeamLeads').find({}).toArray();
    tls.forEach(t => console.log(`- ID: ${t._id}, Name: "${t.name}", Email: "${t.email || t.emailId}"`));

    // Check Employees
    console.log('\n--- Employees in Users collection ---');
    const employees = await db.collection('Users').find({}).toArray();
    employees.slice(0, 10).forEach(e => console.log(`- ID: ${e._id}, Name: "${e.newJoinerName}", Email: "${e.email || e.newJoinerEmailId}"`));
    console.log(`Total employees: ${employees.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}
run();
