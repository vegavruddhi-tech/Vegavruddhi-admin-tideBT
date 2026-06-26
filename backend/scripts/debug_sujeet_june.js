const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const fseName = 'Sujeet Saroj';
  const fseEmail = 'sujeetsaroj2025@gmail.com';

  console.log(`\n=== DEBUGGING FOR FSE: "${fseName}" ===`);

  // 1. Check TideBT_Access
  const access = await db.collection('TideBT_Access').find({
    fseName: { $regex: new RegExp(`^\\s*${fseName}\\s*$`, 'i') }
  }).toArray();
  console.log('\n--- TideBT_Access Records ---');
  if (access.length === 0) {
    console.log(`❌ No access record found in TideBT_Access for "${fseName}"`);
  } else {
    access.forEach(a => {
      console.log(`- fseName: "${a.fseName}", tlName: "${a.tlName}", hasTideBTAccess: ${a.hasTideBTAccess}`);
    });
  }

  // 2. Check bt_master
  const master = await db.collection('bt_master').find({
    $or: [
      { fseEmail: { $regex: new RegExp(`^${fseEmail}$`, 'i') } },
      { fseName: { $regex: new RegExp(`^\\s*${fseName}\\s*\\d*\\s*$`, 'i') } }
    ]
  }).toArray();
  console.log('\n--- bt_master Records ---');
  console.log(`Total assigned merchants in bt_master: ${master.length}`);
  if (master.length > 0) {
    console.log('Sample merchant names and numbers:');
    master.slice(0, 5).forEach(m => {
      console.log(`- Name: "${m.merchantName}", Number: "${m.merchantNumber}", FSE: "${m.fseName}"`);
    });
  }

  // 3. Check BT_TL_CONNECT JUNE matching
  const masterNums = master.map(m => (m.merchantNumber || '').trim()).filter(Boolean);
  const juneColName = 'BT_TL_CONNECT JUNE';

  console.log('\n--- BT_TL_CONNECT JUNE Matching ---');
  if (masterNums.length === 0) {
    console.log('❌ No merchant numbers found in bt_master for this FSE.');
  } else {
    console.log(`Looking up ${masterNums.length} merchant numbers in "${juneColName}"...`);
    const matches = await db.collection(juneColName).find({
      merchantNumber: { $in: masterNums }
    }).toArray();

    console.log(`Matched documents found in June collection: ${matches.length}`);
    if (matches.length > 0) {
      matches.forEach(m => {
        console.log(`- Lead/Merchant: "${m.lead}", Number: "${m.merchantNumber}", Stage-3: "${m.stage3}"`);
      });
    } else {
      // Print first 5 numbers we looked for vs first 5 numbers in the June collection
      console.log('Sample numbers we looked for:', masterNums.slice(0, 5));
      
      const sampleJuneDocs = await db.collection(juneColName).find({}).limit(5).toArray();
      const sampleJuneNums = sampleJuneDocs.map(d => d.merchantNumber);
      console.log('Sample numbers present in BT_TL_CONNECT JUNE:', sampleJuneNums);
    }
  }

  // 4. Check if Sujeet is mapped in the "lead" field or "teamLeadName" field in June
  const byLeadName = await db.collection(juneColName).find({
    $or: [
      { lead: { $regex: new RegExp(fseName, 'i') } },
      { teamLeadName: { $regex: new RegExp(fseName, 'i') } }
    ]
  }).limit(3).toArray();
  console.log('\n--- Searching by name directly in June collection ---');
  console.log(`Found direct name matches in June collection: ${byLeadName.length}`);
  if (byLeadName.length > 0) {
    byLeadName.forEach(m => {
      console.log(`- Lead: "${m.lead}", TeamLeadName: "${m.teamLeadName}", Number: "${m.merchantNumber}"`);
    });
  }

  await mongoose.connection.close();
}

run().catch(console.error);
