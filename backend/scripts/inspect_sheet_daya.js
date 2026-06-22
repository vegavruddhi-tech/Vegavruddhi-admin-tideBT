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
      range: 'RP!A:Z'
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No rows found in sheet');
      return;
    }

    const headers = rows[0].map(h => String(h).trim());
    console.log('Headers:', headers);

    const fseColIdx = headers.findIndex(h => h.toLowerCase() === 'fse');
    console.log('FSE Column Index:', fseColIdx);

    const matchingRows = [];
    rows.forEach((row, idx) => {
      if (idx === 0) return;
      const fseName = row[fseColIdx] || '';
      if (fseName.toLowerCase().includes('daya') || fseName.toLowerCase().includes('shimon')) {
        matchingRows.push({ rowNumber: idx + 1, rowData: row });
      }
    });

    console.log(`\nFound ${matchingRows.length} matching rows for Daya/Shimon:`);
    matchingRows.slice(0, 10).forEach(r => {
      console.log(`Row ${r.rowNumber}:`, r.rowData);
    });

  } catch (error) {
    console.error('Error fetching sheet data:', error.message);
  }
}

run();
