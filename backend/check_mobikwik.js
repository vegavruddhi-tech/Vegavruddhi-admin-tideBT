const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // List all collections containing "mobikwik" or "withdraw"
  const all = (await db.listCollections().toArray()).map(c => c.name);
  const relevant = all.filter(c => c.toLowerCase().includes('mobikwik') || c.toLowerCase().includes('withdraw') || c.toLowerCase().includes('tidebt'));
  console.log('Relevant collections:', relevant);

  // Check TideBT Form Responses for mobikwik-withdraw
  const fromFormResponses = await db.collection('TideBT Form Responses').countDocuments({ formType: 'mobikwik-withdraw' });
  console.log('\nTideBT Form Responses (formType=mobikwik-withdraw):', fromFormResponses);
  
  // Check tidebt_form_responses (app submitted)
  const fromApp = await db.collection('tidebt_form_responses').countDocuments({ formType: 'mobikwik-withdraw' });
  console.log('tidebt_form_responses (formType=mobikwik-withdraw):', fromApp);
  
  // Sample from app collection
  if (fromApp > 0) {
    const sample = await db.collection('tidebt_form_responses').findOne({ formType: 'mobikwik-withdraw' });
    console.log('\nSample from tidebt_form_responses:', JSON.stringify(sample, null, 2).slice(0, 500));
  }
  
  // Sample from TideBT Form Responses
  if (fromFormResponses > 0) {
    const sample = await db.collection('TideBT Form Responses').findOne({ formType: 'mobikwik-withdraw' });
    console.log('\nSample from TideBT Form Responses:', JSON.stringify(sample, null, 2).slice(0, 500));
  }

  mongoose.disconnect();
}).catch(e => console.error('Error:', e.message));
