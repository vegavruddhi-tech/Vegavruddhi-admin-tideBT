const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const emails = ['piyushchandhp222@gmail.com', 'shahvejaalm39@gmail.com', 'sandhugagan7569@gmail.com', 'rohitkumar952870@gmail.com', 'ranjeetkumarraja5198@gmail.com'];

  // Check Users collection
  const userSample = await db.collection('Users').findOne();
  console.log('Users fields:', userSample ? Object.keys(userSample) : 'empty');
  for (const email of emails.slice(0,3)) {
    const u = await db.collection('Users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    console.log(`Users [${email}]:`, u ? (u.name || u.newJoinerName || u.employeeName || JSON.stringify(u).slice(0,100)) : 'not found');
  }

  // Check TideBT Form Responses — has employeeEmail
  const formSample = await db.collection('TideBT Form Responses').findOne();
  console.log('\nTideBT Form Responses fields:', formSample ? Object.keys(formSample) : 'empty');
  for (const email of emails.slice(0,3)) {
    const f = await db.collection('TideBT Form Responses').findOne({ employeeEmail: { $regex: new RegExp(`^${email}$`, 'i') } });
    console.log(`TideBT Form Responses [${email}]:`, f ? f.employeeName : 'not found');
  }

  // Check TideBT_Mobikwik itself — May records had employeeName, so maybe same email exists in May
  for (const email of emails.slice(0,3)) {
    const may = await db.collection('TideBT_Mobikwik').findOne({ employeeEmail: email, employeeName: { $ne: '' } });
    console.log(`\nTideBT_Mobikwik May match [${email}]:`, may ? may.employeeName : 'not found');
  }

  mongoose.disconnect();
}).catch(e => console.error('Error:', e.message));
