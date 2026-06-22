const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // Check records with createdAt = 19 Jun 2026
  const recent = await db.collection('TideBT_Mobikwik').find({
    createdAt: { $gte: new Date('2026-06-19') }
  }).limit(3).toArray();
  console.log('Recent records (19 Jun 2026):');
  recent.forEach(r => console.log(JSON.stringify(r, null, 2).slice(0, 500)));

  // Check records with actual data
  const withData = await db.collection('TideBT_Mobikwik').find({
    merchantName: { $exists: true, $ne: '' },
    withdrawAmount: { $gt: 0 }
  }).limit(3).toArray();
  console.log('\nRecords with merchantName & withdrawAmount:');
  withData.forEach(r => console.log(' -', r.merchantName, '|', r.merchantNumber, '|', r.withdrawAmount, '|', r.employeeName, '|', r.createdAt));

  // Check what createdAt looks like
  const sample = await db.collection('TideBT_Mobikwik').findOne({ withdrawAmount: { $gt: 0 } });
  console.log('\nSample with amount > 0:', JSON.stringify(sample, null, 2).slice(0, 600));

  mongoose.disconnect();
}).catch(e => console.error('Error:', e.message));
