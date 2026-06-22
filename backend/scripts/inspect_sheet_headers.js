const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  let sheetId = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'RP!1:1' // Fetch first row (headers)
    });
    console.log('--- Headers in RP sheet tab ---');
    console.log(response.data.values ? response.data.values[0] : 'No headers found');

    const sampleRow = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'RP!2:2' // Fetch first data row
    });
    console.log('\n--- Sample Row 2 in RP sheet tab ---');
    console.log(sampleRow.data.values ? sampleRow.data.values[0] : 'No data row found');

  } catch (error) {
    console.error('Error fetching sheet data:', error.message);
  }
}

run();
