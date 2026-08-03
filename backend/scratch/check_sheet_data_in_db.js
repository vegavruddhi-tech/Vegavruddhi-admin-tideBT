const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkSheetData() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    const names = ['saurabh kaundal', 'Pradeep kumar', 'Piyush Chand', 'Ashwani Kumar', 'VG'];
    
    console.log('🔍 Searching MongoDB TideBT_Payments for payments matching screenshot:');

    for (const name of names) {
      const docs = await db.collection('TideBT_Payments').find({
        $or: [
          { transferTo: new RegExp(name, 'i') },
          { senderName: new RegExp(name, 'i') }
        ]
      }).toArray();

      console.log(`\n--- Results for "${name}" (Found ${docs.length}) ---`);
      docs.forEach(d => {
        console.log(`  Amount: ₹${d.amount} | Sender: "${d.senderName}" | Receiver: "${d.transferTo}" | Whom: "${d.transferToWhom}" | Date: "${d.paymentDoneOn || d.createdAt}"`);
      });
    }

    const ashwaniDocs = await db.collection('TideBT_Payments').find({
      $or: [
        { senderName: new RegExp('Ashwani', 'i') },
        { transferTo: new RegExp('Ashwani', 'i') }
      ]
    }).toArray();

    console.log(`\nTotal payments matching "Ashwani" in DB: ${ashwaniDocs.length}`);

    process.exit(0);
  } catch (err) {
    console.error('Check error:', err.message);
    process.exit(1);
  }
}

checkSheetData();
