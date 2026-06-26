const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = '1Ayv7kBacQbUBFWJHMJcM7PQmqzlKaMuw'; // GOOGLE_SHEET_ID_3

  console.log(`Inspecting spreadsheet 3 tabs: ${sheetId}`);
  
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabs = meta.data.sheets.map(s => s.properties.title);
    console.log('Available tabs in GOOGLE_SHEET_ID_3:', tabs);

    const matchTabs = tabs.filter(t => t.toUpperCase().includes('CONNECT') || t.toUpperCase().includes('BT') || t.toUpperCase().includes('TL'));
    console.log('\nPotential matching tabs:', matchTabs);

    for (const tab of matchTabs) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tab}!A1:Z5`
      });
      const rows = res.data.values || [];
      console.log(`\n--- Tab: "${tab}" (rows: ${rows.length}) ---`);
      if (rows.length > 0) {
        console.log('Headers:', rows[0].slice(0, 10));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
