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
    const sheetId = '1L40ixfYKTNosKG2Kryeknq7WjNCxeUcnYGqvjSIK5os';

    console.log(`Checking spreadsheet ID: ${sheetId}`);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabs = meta.data.sheets.map(s => s.properties.title);
    console.log('Available tabs:', tabs);

    const checkTab = tabs.find(t => t.toLowerCase() === 'bt amount') || 'BT amount';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${checkTab}!A1:Z10`
    });
    const rows = response.data.values || [];
    console.log(`\nTab: "${checkTab}" -> rows: ${rows.length}`);
    if (rows.length > 0) {
      console.log('Row 1:', rows[0].slice(0, 10));
      if (rows[1]) console.log('Row 2:', rows[1].slice(0, 10));
    }
  } catch (error) {
    console.error('❌ Error reading spreadsheet:', error.message);
  }
}

run();
