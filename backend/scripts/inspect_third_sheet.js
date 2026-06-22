const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = '1Ayv7kBacQbUBFWJHMJcM7PQmqzlKaMuw'; // check this sheet ID
    
    console.log(`Inspecting spreadsheet: ${sheetId}`);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabs = meta.data.sheets.map(s => s.properties.title);
    console.log('Available tabs:', tabs);

    const checkTabs = ['BT Amount', 'BT amount'];
    for (const tab of checkTabs) {
      if (tabs.includes(tab)) {
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${tab}!A1:Z10`
          });
          const rows = response.data.values;
          console.log(`\n--- TAB: "${tab}" ---`);
          if (!rows || rows.length === 0) {
            console.log('No data found.');
          } else {
            console.log(`Total rows: ${rows.length}`);
            console.log('Row 1:', rows[0].slice(0, 10));
            if (rows[1]) console.log('Row 2:', rows[1].slice(0, 10));
          }
        } catch (e) {
          console.log(`Failed to read "${tab}":`, e.message);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
