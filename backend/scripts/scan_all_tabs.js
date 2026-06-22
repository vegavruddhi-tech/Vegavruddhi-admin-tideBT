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

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabs = meta.data.sheets.map(s => s.properties.title);
    console.log(`Scanning all ${tabs.length} tabs...`);

    for (const tab of tabs) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tab}!A1:B10`
      });
      const rows = response.data.values || [];
      if (rows.length > 1) { // print tabs that have more than 1 row
        console.log(`Tab: "${tab}" -> rows: ${rows.length} (first cell: "${rows[0][0] || ''}")`);
      } else if (rows.length === 1) {
        console.log(`Tab: "${tab}" -> 1 row (empty or header only: "${rows[0][0] || ''}")`);
      } else {
        console.log(`Tab: "${tab}" -> 0 rows`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
