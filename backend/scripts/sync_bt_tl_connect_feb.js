/**
 * Sync BT_TL_CONNECT FEB 26 from sheet 1ebvpDwSwPV6s-C2QPAkRserFv2yV_6n1NujDZZj4ako
 * Tab: BT TL CONNECT FEB 26  →  Collection: BT_TL_CONNECT FEB 26
 */
const { google } = require('googleapis');
const mongoose  = require('mongoose');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const mongoUri        = process.env.MONGODB_URI || process.env.MONGO_URI;
  const sheetId         = '1ebvpDwSwPV6s-C2QPAkRserFv2yV_6n1NujDZZj4ako';
  const tabName         = 'BT TL CONNECT FEB 26';
  const mongoCollection = 'BT_TL_CONNECT FEB 26';

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`📥 Fetching "${tabName}"...`);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tabName}!A:ZZ` });
  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('No data.'); return; }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(h => String(h || '').trim());
  console.log(`Headers (${headers.length}):`, headers);
  console.log(`Total data rows: ${rows.length - 1}`);

  const idx = (names) => { for (const n of names) { const i = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase())); if (i !== -1) return i; } return -1; };
  const iMobileNo = idx(['mobile no']); const iNumber = idx(['number']);
  const iStage3 = headers.findIndex(h => h.toLowerCase().replace(/\s/g,'') === 'stage-3' || h.toLowerCase().replace(/\s/g,'') === 'stage3');
  const iStage3Gap = idx(['stage-3 gap','stage3 gap']);
  const iPassLive = idx(['pass live','pass_live']); const iRPPro = idx(['priority pass pro','reward pass pro']);
  const iUPIActive = idx(['upi active']); const iUPITxn = idx(['upi txn','txn count']);
  const iPartner = idx(['partner']); const iTL = headers.findIndex(h => h.toLowerCase() === 'tl name' || h.toLowerCase() === 'team lead name');
  const iLead = headers.findIndex(h => h.toLowerCase() === 'lead');
  const iWithdraw = idx(['qr load amount','upi amount','withdraw amount']);
  const iMSME = idx(['msme/gst','msme']); const iInsurance = idx(['insurance']); const iPriority = idx(['priority pass status']);

  const parseNum = v => { if (!v) return 0; const n = parseFloat(String(v).replace(/,/g,'').trim()); return isNaN(n) ? 0 : n; };
  const getVal = (row, i) => (i !== -1 && row[i] !== undefined) ? String(row[i]).trim() : '';
  const normMobile = v => { if (!v) return ''; const d = v.replace(/\D/g,''); if (d.length===12&&d.startsWith('91')) return d.slice(2); if (d.length===11&&d.startsWith('0')) return d.slice(1); if (d.length===10) return d; return d; };
  const getMerchantNumber = row => { const v = normMobile(getVal(row,iMobileNo)); if (v&&v.length>=7) return v; const v2 = normMobile(getVal(row,iNumber)); if (v2&&v2.length>=7) return v2; return v||v2; };

  const docs = []; let skipped = 0;
  rows.slice(1).forEach((row, i) => {
    const merchantNumber = getMerchantNumber(row);
    if (!merchantNumber || merchantNumber.length < 7) { skipped++; return; }
    docs.push({
      month:'February', partnerName: getVal(row,iPartner), teamLeadName: getVal(row,iTL), lead: getVal(row,iLead),
      merchantNumber, stage3: parseNum(getVal(row,iStage3)), stage3Gap: parseNum(getVal(row,iStage3Gap)),
      upiActive: getVal(row,iUPIActive)||'–', upiTxnCount: parseNum(getVal(row,iUPITxn)),
      passLive: getVal(row,iPassLive)||'–', rewardPassPro: getVal(row,iRPPro)||'–',
      msmegstStatus: getVal(row,iMSME)||'–', insuranceStatus: getVal(row,iInsurance)||'–',
      priorityPassStatus: getVal(row,iPriority)||'–', withdrawAmount: parseNum(getVal(row,iWithdraw)),
      _syncedAt: new Date(), _rowIndex: i+2
    });
  });

  console.log(`\nParsed: ${docs.length} valid, skipped: ${skipped}`);
  docs.slice(0,3).forEach(d => console.log(`  ${d.merchantNumber} | stage3=₹${d.stage3} | rp=${d.rewardPassPro}`));

  await mongoose.connect(mongoUri, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;
  await db.collection(mongoCollection).deleteMany({});
  if (docs.length > 0) {
    const result = await db.collection(mongoCollection).insertMany(docs);
    console.log(`✅ Inserted ${result.insertedCount} into "${mongoCollection}"`);
    const totalBT = docs.reduce((s,d) => s+d.stage3, 0);
    console.log(`Total BT: ₹${totalBT.toLocaleString()}, RP Active: ${docs.filter(d=>d.rewardPassPro.toLowerCase()==='active').length}`);
  }
  await mongoose.connection.close();
  console.log('Done ✅');
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
