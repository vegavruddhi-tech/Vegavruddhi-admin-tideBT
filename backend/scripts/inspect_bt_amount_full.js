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
    const tab = 'BT amount';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tab}!A1:Z20`
    });
    const rows = response.data.values || [];
    console.log(`Tab: "${tab}" -> returned rows: ${rows.length}`);
    rows.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, row);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
