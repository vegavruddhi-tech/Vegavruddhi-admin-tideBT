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

  const spreadsheets = [
    { name: 'GOOGLE_SHEET_ID', id: process.env.GOOGLE_SHEET_ID },
    { name: 'GOOGLE_SHEET_ID_2 / TIDEBT_SHEET_ID', id: process.env.TIDEBT_SHEET_ID },
    { name: 'GOOGLE_SHEET_ID_3', id: '1Ayv7kBacQbUBFWJHMJcM7PQmqzlKaMuw' }
  ];

  console.log('=== SCANNING ALL CONFIGURED SPREADSHEETS FOR JUNE DATA ===\n');

  for (const s of spreadsheets) {
    if (!s.id) {
      console.log(`Skipping ${s.name} (not set in env)\n`);
      continue;
    }
    console.log(`Scanning ${s.name} (${s.id})...`);
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: s.id });
      const tabs = meta.data.sheets.map(sh => sh.properties.title);
      console.log(`Available tabs:`, tabs);

      for (const tab of tabs) {
        // Only inspect tabs that could contain June connect data
        const tu = tab.toUpperCase();
        if (tu.includes('JUNE') || tu.includes('JUN') || tu === 'BT' || tu === 'RP/BT' || tu === 'FT') {
          try {
            const res = await sheets.spreadsheets.values.get({
              spreadsheetId: s.id,
              range: `${tab}!A1:Z500` // Fetch up to 500 rows to check content
            });
            const rows = res.data.values || [];
            if (rows.length > 0) {
              const headers = rows[0].map(h => String(h).trim());
              // Check if it's a connect sheet (has Lead, Stage-3, Mobile No columns)
              const hasLead = headers.some(h => h.toLowerCase().includes('lead'));
              const hasStage3 = headers.some(h => h.toLowerCase().includes('stage-3') || h.toLowerCase().includes('stage3'));
              const hasNumber = headers.some(h => h.toLowerCase().includes('number') || h.toLowerCase().includes('mobile'));

              if (hasLead && hasStage3 && hasNumber) {
                console.log(`  👉 Found Connect Sheet Tab: "${tab}" (${rows.length} rows fetched)`);
                // Check if it contains multiple partners or just one
                const partnerIdx = headers.findIndex(h => h.toLowerCase().includes('partner'));
                const partners = new Set();
                rows.slice(1).forEach(r => {
                  if (r[partnerIdx]) partners.add(r[partnerIdx].trim());
                });
                console.log(`     Headers:`, headers.slice(0, 8));
                console.log(`     Partners found in first 500 rows:`, Array.from(partners));
              }
            }
          } catch (e) {
            // Tab read error
          }
        }
      }
      console.log('--------------------------------------------------\n');
    } catch (err) {
      console.error(`Error loading ${s.name}:`, err.message, '\n');
    }
  }
}

run();
