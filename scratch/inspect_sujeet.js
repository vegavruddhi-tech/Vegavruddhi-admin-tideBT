const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, dbName: 'CompanyDB' });
    const db = mongoose.connection.db;

    // Check Sujeet Saroj reward passes
    const rpList = await db.collection('TideBT_RewardPass').find({ employeeName: /sujeet/i }).toArray();
    console.log('--- SUJEET REWARD PASSES ---');
    console.log(JSON.stringify(rpList, null, 2));

    // Check Sujeet Saroj onboarding forms
    const formsList = await db.collection('TideBT Form Responses').find({ 
      $or: [
        { employeeName: /sujeet/i },
        { fse: /sujeet/i }
      ]
    }).toArray();
    console.log('\n--- SUJEET FORM RESPONSES ---');
    console.log(`Total forms: ${formsList.length}`);
    formsList.forEach((f, i) => {
      console.log(`Form ${i+1}: Merchant=${f.merchantName}, Opinion=${f.merchantOpinion}, OnboardingStatus=${f.onboardingStatus}, FormType=${f.formType}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}
run();
