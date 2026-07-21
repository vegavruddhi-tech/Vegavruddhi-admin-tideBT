require('dotenv').config();
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

client.connect().then(async () => {
  const db = client.db('CompanyDB');

  // Check TeamLeads collection for Rohit
  const tls = await db.collection('TeamLeads').find({
    name: { $regex: /rohit/i }
  }).project({ name: 1, email: 1, emailId: 1, approvalStatus: 1 }).toArray();
  console.log('TeamLeads with "Rohit" in name:', JSON.stringify(tls, null, 2));

  // Check what TideBT_Access returns for tlName = "Rohit"
  const accessRohit = await db.collection('TideBT_Access').find({ tlName: { $regex: /^rohit$/i } }).toArray();
  console.log('\nTideBT_Access where tlName = "Rohit" exactly:', accessRohit.map(d => ({ fseName: d.fseName, tlName: d.tlName })));

  // The problem — what does firstWord "Rohit" match in fseName?
  const fseRohit = await db.collection('TideBT_Access').find({ fseName: { $regex: /^rohit/i } }).toArray();
  console.log('\nTideBT_Access where fseName starts with "Rohit":', fseRohit.map(d => ({ fseName: d.fseName, tlName: d.tlName })));

  client.close();
}).catch(e => console.error(e.message));
