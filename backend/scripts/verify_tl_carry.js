/**
 * Verify TL carry forward — checks received AND sent to FSEs
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('CompanyDB');

  const allPayments = await db.collection('TideBT_Payments').find({}).toArray();
  const accessList  = await db.collection('TideBT_Access').find({}).toArray();
  const fseNameSet  = new Set(accessList.map(a => (a.fseName||'').trim().toLowerCase()));

  const curYear = 2026;
  const pastMonths = MONTHS.slice(0, 6); // Jan-Jun

  const tlsToCheck = ['Ravi Kumar', 'Ashwani', 'Niteesh Kumar Saroj'];

  for (const tlName of tlsToCheck) {
    const tlLower = tlName.toLowerCase();
    let runningBalance = 0;
    console.log(`\n===== TL: ${tlName} =====`);

    for (const monthName of pastMonths) {
      const monthPmts = allPayments.filter(p => {
        if (!p.createdAt) return false;
        const d = new Date(p.createdAt);
        return d.getFullYear() === curYear && MONTHS[d.getMonth()] === monthName;
      });

      // Received by TL (TL's & Managers type)
      const received = monthPmts
        .filter(p => (p.transferTo||'').trim().toLowerCase() === tlLower && 
                     (p.transferToWhom||'').includes("TL"))
        .reduce((s, p) => s + (p.amount||0), 0);

      // Received as FSE type (wrong entry — still counts)
      const receivedFSEType = monthPmts
        .filter(p => (p.transferTo||'').trim().toLowerCase() === tlLower && 
                     !(p.transferToWhom||'').includes("TL"))
        .reduce((s, p) => s + (p.amount||0), 0);

      // Sent by TL to FSEs
      const sentToFSEs = monthPmts
        .filter(p => (p.senderName||'').trim().toLowerCase() === tlLower &&
                     (p.transferToWhom||'') === "FSE Ground Team" &&
                     (p.transferTo||'').trim().toLowerCase() !== tlLower)
        .reduce((s, p) => s + (p.amount||0), 0);

      const totalReceived = received + receivedFSEType;
      const net = totalReceived - sentToFSEs;
      const prevBal = runningBalance;
      runningBalance = Math.max(0, runningBalance + net);

      if (totalReceived !== 0 || sentToFSEs !== 0) {
        console.log(`  ${monthName}: rcvd_TL=₹${received.toLocaleString()} rcvd_FSEtype=₹${receivedFSEType.toLocaleString()} sentFSEs=₹${sentToFSEs.toLocaleString()} net=₹${net.toLocaleString()} balance=₹${runningBalance.toLocaleString()}`);
      }
    }
    console.log(`  → Carry forward into July: ₹${runningBalance.toLocaleString()}`);
  }

  await client.close();
}
run().catch(console.error);
