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
    const sheetId = process.env.TIDEBT_SHEET_ID;
    const tabs = ['BT', 'Day BT', 'RP/BT', 'BT/Pass', 'BT amount'];

    for (const tab of tabs) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${tab}!A1:Z100`
        });
        const rows = response.data.values;
        console.log(`\n--- TAB: "${tab}" ---`);
        if (!rows || rows.length === 0) {
          console.log('No data found.');
          continue;
        }
        console.log(`Total rows returned: ${rows.length}`);
        
        let count = 0;
        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          if (row.some(cell => cell && String(cell).trim() !== '')) {
            console.log(`Row ${idx + 1}:`, row.slice(0, 10)); // print first 10 columns of row
            count++;
            if (count >= 3) break;
          }
        }
      } catch (e) {
        console.log(`Tab "${tab}" failed:`, e.message);
      }
    }
  } catch (error) {
    console.error('Fatal:', error.message);
  }
}

run();
