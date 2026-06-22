const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const count = await db.collection('TideBT_Mobikwik').countDocuments();
  console.log('TideBT_Mobikwik total docs:', count);
  
  if (count > 0) {
    const sample = await db.collection('TideBT_Mobikwik').findOne();
    console.log('Sample doc fields:', Object.keys(sample));
    console.log('Sample:', JSON.stringify(sample, null, 2).slice(0, 800));
  }
  
  mongoose.disconnect();
}).catch(e => console.error('Error:', e.message));
