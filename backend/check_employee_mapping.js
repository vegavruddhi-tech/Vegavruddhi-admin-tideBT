const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;

  // May records — compare with June
  const mayRec = await db.collection('TideBT_Mobikwik').findOne({ month: /May-26/ });
  console.log('=== MAY record ===');
  if (mayRec) {
    console.log('employeeName:', mayRec.employeeName);
    console.log('employeeEmail:', mayRec.employeeEmail);
    console.log('fse:', mayRec.fse);
    console.log('tl:', mayRec.tl);
  } else console.log('No May-26 records');

  // June records
  const junRec = await db.collection('TideBT_Mobikwik').findOne({ month: /Jun-26/ });
  console.log('\n=== JUNE record ===');
  if (junRec) {
    console.log('employeeName:', junRec.employeeName);
    console.log('employeeEmail:', junRec.employeeEmail);
    console.log('fse:', junRec.fse);
    console.log('tl:', junRec.tl);
    console.log('All fields:', Object.keys(junRec));
  }

  // Try to lookup June employee by email
  const junEmail = junRec?.employeeEmail;
  console.log('\n=== Looking up employee by email:', junEmail);
  if (junEmail) {
    const emp = await db.collection('Employees').findOne({
      $or: [
        { newJoinerEmailId: { $regex: new RegExp(`^${junEmail}$`, 'i') } },
        { email: { $regex: new RegExp(`^${junEmail}$`, 'i') } }
      ]
    });
    console.log('Found employee:', emp ? emp.newJoinerName : 'NOT FOUND');
    
    // Check what fields Employees collection uses for email
    if (!emp) {
      const anyEmp = await db.collection('Employees').findOne({});
      console.log('Employees fields:', anyEmp ? Object.keys(anyEmp).filter(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('name')) : 'No employees');
    }
  }

  // Check all June emails and see which ones match
  const juneDocs = await db.collection('TideBT_Mobikwik').find({ month: /Jun-26/, withdrawAmount: { $gt: 0 } }).toArray();
  console.log('\n=== June docs with withdrawAmount > 0:', juneDocs.length);
  const emails = [...new Set(juneDocs.map(d => d.employeeEmail).filter(Boolean))];
  console.log('Unique emails:', emails.slice(0, 10));
  
  // Check how many of these emails exist in Employees
  let found = 0;
  for (const email of emails) {
    const e = await db.collection('Employees').findOne({
      $or: [{ newJoinerEmailId: email }, { email: email }]
    });
    if (e) { found++; console.log('  MATCH:', email, '→', e.newJoinerName); }
    else console.log('  NO MATCH:', email);
  }
  console.log(`\nMatched ${found}/${emails.length} emails`);

  mongoose.disconnect();
}).catch(e => console.error('Error:', e.message));
