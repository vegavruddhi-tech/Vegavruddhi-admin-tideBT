/**
 * Send TideBT daily report email directly (no HTTP call needed)
 * Run after BT sync: node scripts/send_bt_report.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { sendTideBTDailyReport } = require('../utils/tideBTDailyReport');

async function run() {
  console.log('📧 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  console.log('📧 Sending daily BT report email...');
  const result = await sendTideBTDailyReport(db);

  if (result.success) {
    console.log(`✅ Report sent to: ${(result.recipients || []).join(', ')}`);
    console.log(`   FTD BT: ₹${(result.ftdBT || 0).toLocaleString()}`);
    console.log(`   FTD RP: ${result.ftdRP || 0}`);
    console.log(`   MTD BT: ₹${(result.mtdBT || 0).toLocaleString()}`);
    console.log(`   MTD RP: ${result.mtdRP || 0}`);
  } else {
    console.error('❌ Report failed:', result.reason || result.error);
  }

  await mongoose.connection.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
