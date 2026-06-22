const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const emails = ['piyushchandhp222@gmail.com', 'shahvejaalm39@gmail.com', 'sandhugagan7569@gmail.com'];

  // List all collections
  const colls = (await db.listCollections().toArray()).map(c => c.name);
  console.log('Collections with "employee" or "user":', colls.filter(c => /employee|user|fse|worker|staff/i.test(c)));
  console.log('All collections:', colls);

  // Check Employees count
  const empCount = await db.collection('Employees').countDocuments();
  console.log('\nEmployees count:', empCount);

  // Try TideBT_Access — does it have email?
  const accessSample = await db.collection('TideBT_Access').findOne();
  console.log('\nTideBT_Access sample fields:', accessSample ? Object.keys(accessSample) : 'empty');

  // Try Forms_respones
  try {
    const formSample = await db.collection('Forms_respones').findOne();
    console.log('\nForms_respones fields:', formSample ? Object.keys(formSample).filter(k => /email|name|emp/i.test(k)) : 'empty');
    // Search by email
    const match = await db.collection('Forms_respones').findOne({ 'Email ID': { $in: emails } });
    console.log('Forms_respones match by Email ID:', match ? match['Name'] || match['employeeName'] : 'not found');
  } catch(e) { console.log('Forms_respones error:', e.message); }

  mongoose.disconnect();
}).catch(e => console.error('Error:', e.message));
