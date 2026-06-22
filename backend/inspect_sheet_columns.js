const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
    const tabName = 'From Jan';

    console.log(`Fetching from Sheet ID: ${sheetId}, Tab: ${tabName}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A1:Z10`
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found.');
      return;
    }

    console.log('\n=== Google Sheet Headers ===');
    console.log(rows[0]);

    console.log('\n=== Google Sheet Row 1 & 2 Sample ===');
    console.log('Row 1:', rows[1]);
    console.log('Row 2:', rows[2]);

  } catch (error) {
    console.error('❌ Error reading sheet:', error);
  }
}

run();
