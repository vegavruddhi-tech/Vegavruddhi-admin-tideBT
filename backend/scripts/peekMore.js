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
  const sheetId = process.env.TIDEBT_SHEET_ID;

  const tabs = ['MK', 'RP/BT', 'BT/Pass'];

  for (const tab of tabs) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tab}!A1:H10` // peek first 10 rows, columns A-H
      });
      const rows = response.data.values;
      console.log(`\n--- FIRST 5 ROWS OF "${tab}" TAB ---`);
      if (!rows || rows.length === 0) {
        console.log('No data found.');
        continue;
      }
      rows.slice(0, 5).forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`, row);
      });
    } catch (e) {
      console.log(`Tab "${tab}" failed or not found:`, e.message);
    }
  }
}

run();
