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

  console.log(`Scanning all tabs in spreadsheet: ${sheetId} for "Sujeet"...`);
  
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabs = meta.data.sheets.map(s => s.properties.title);

    let foundAny = false;

    for (const tab of tabs) {
      // Fetch the first 200 rows of each tab to search
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tab}!A1:Z200`
      });

      const rows = response.data.values || [];
      
      let matchedInTab = 0;
      rows.forEach((row, rowIdx) => {
        const rowStr = JSON.stringify(row).toLowerCase();
        if (rowStr.includes('sujeet') || rowStr.includes('9918304056')) {
          matchedInTab++;
          if (matchedInTab <= 3) {
            console.log(`[FOUND] Match in tab "${tab}" on Row ${rowIdx + 1}:`, row.slice(0, 8));
          }
        }
      });

      if (matchedInTab > 0) {
        console.log(`👉 Tab "${tab}" has a total of ${matchedInTab} rows matching "Sujeet".`);
        foundAny = true;
      }
    }

    if (!foundAny) {
      console.log('❌ "Sujeet" was not found in any tab of this spreadsheet.');
    }

  } catch (error) {
    console.error('Error scanning spreadsheet:', error.message);
  }
}

run();
