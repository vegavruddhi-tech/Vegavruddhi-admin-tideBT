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
  const sheetId = '1XD1x9VeyGbGnCKw2w8pAlsf6zoxs59OSKxpRDcgmZ6U'; // GOOGLE_SHEET_ID

  console.log(`Inspecting spreadsheet tabs structure...`);
  
  try {
    // 1. Inspect "TL connect May" tab
    const resMay = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'TL connect May!A1:Z5'
    });
    console.log('\n--- TL connect May Sample (Headers + First 4 rows) ---');
    const rowsMay = resMay.data.values || [];
    rowsMay.forEach((r, idx) => console.log(`Row ${idx+1}:`, r.slice(0, 10)));

    // 2. Inspect "TL connect June" tab
    const resJune = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'TL connect June!A1:Z5'
    });
    console.log('\n--- TL connect June Sample (Headers + First 4 rows) ---');
    const rowsJune = resJune.data.values || [];
    rowsJune.forEach((r, idx) => console.log(`Row ${idx+1}:`, r.slice(0, 10)));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
