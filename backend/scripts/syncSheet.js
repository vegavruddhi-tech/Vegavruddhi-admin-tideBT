/**
 * Google Sheets to MongoDB Sync Script for Tide BT Admin Panel
 * 
 * Usage:
 *   node scripts/syncSheet.js --tab "PT 8" --collection "TideBT_Access"
 *   node scripts/syncSheet.js --tab "Tide BT Onboarding" --collection "TideBT Form Responses" --clear
 *   node scripts/syncSheet.js [sheetId] [tabName] [collectionName] [--clear]
 */

const { google } = require('googleapis');
const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

// Bypass local DNS SRV timeouts by using public Google/Cloudflare DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Silent fallback
}

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Helper to clean keys
const cleanKey = (k) => {
  return k.replace(/[^\w]/g, '_').toLowerCase().trim();
};

// Helper to normalize phone numbers
const normalizePhone = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

// Helper to parse date formats relative to Indian Standard Time (IST) timezone
const parseDate = (val) => {
  if (!val || String(val).trim() === '') return null;
  let valStr = String(val).trim();
  if (['0', '00', '-', 'N/A', 'NA', 'null', 'None', ''].includes(valStr)) return null;

  // Clean string and normalize spaces
  valStr = valStr.replace(/\s+/g, ' ');
  const spaceParts = valStr.split(' ');
  const datePart = spaceParts[0];
  const timePart = spaceParts[1];

  const parts = datePart.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      y = parseInt(parts[0]);
      m = parseInt(parts[1]);
      d = parseInt(parts[2]);
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY or MM/DD/YYYY
      const parsedTemp = new Date(valStr);
      if (!isNaN(parsedTemp.getTime())) {
        y = parsedTemp.getFullYear();
        m = parsedTemp.getMonth() + 1;
        d = parsedTemp.getDate();
      } else {
        y = parseInt(parts[2]);
        m = parseInt(parts[1]);
        d = parseInt(parts[0]);
      }
    } else if (parts[2].length === 2) {
      y = 2000 + parseInt(parts[2]);
      m = parseInt(parts[1]);
      d = parseInt(parts[0]);
    }

    if (y && m && d) {
      if (timePart) {
        // Parse timestamp as IST (+05:30)
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const isoStr = `${y}-${mm}-${dd}T${timePart}+05:30`;
        const parsed = new Date(isoStr);
        if (!isNaN(parsed.getTime())) return parsed;
      } else {
        // Parse pure date as midnight UTC (T00:00:00.000Z)
        return new Date(Date.UTC(y, m - 1, d));
      }
    }
  }

  const parsed = new Date(valStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

// Helper to parse numbers
const parseNumber = (val) => {
  if (!val || String(val).trim() === '') return 0;
  const cleaned = String(val).replace(/[^\d\.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Maps Google Sheet headers to camelCase fields based on Tide BT Schema
const mapHeaderToField = (header, collectionName) => {
  const clean = header.toLowerCase().trim().replace(/[^a-zA-Z0-9\s]/g, '');

  // Specific mappings for TideBT_Payments
  if (collectionName === 'TideBT_Payments') {
    if (clean.includes('sender name') || clean.includes('sender')) return 'senderName';
    if (clean.includes('receiver') || clean.includes('transfer to') || clean.includes('employee') || clean.includes('fse') || clean.includes('name')) return 'transferTo';
    if (clean.includes('amount')) return 'amount';
    if (clean.includes('type') || clean.includes('whom')) return 'transferToWhom';
    if (clean.includes('payment done') || clean.includes('method') || clean.includes('pay')) return 'paymentDoneOn';
    if (clean.includes('created') || clean.includes('date') || clean.includes('timestamp')) return 'createdAt';
  }

  // Specific mappings for TideBT_RewardPass
  if (collectionName === 'TideBT_RewardPass') {
    if (clean.includes('rp count') || clean.includes('claimed rp') || clean.includes('total rp')) return 'totalRPCount';
    if (clean.includes('bt amount') || clean.includes('total bt')) return 'totalBTAmount';
    if (clean.includes('reward pass amount') || clean.includes('rp amount')) return 'rewardPassAmount';
    if (clean.includes('bank transfer fees') || clean.includes('bt fees')) return 'bankTransferFees';
    
    // Check specific columns first to prevent overlaps
    if (clean.includes('working update') || clean.includes('update')) return 'workingUpdate';
    if (clean.includes('time stamp') || clean.includes('timestamp')) return 'createdAt';
    if (clean.includes('date of working') || clean.includes('working date') || clean.includes('date')) return 'dateOfWorking';
    
    if (clean === 'fsc' || clean === 'fse' || clean.includes('employee name') || clean.includes('fse name') || clean.includes('name')) return 'employeeName';
    if (clean.includes('email address') || clean.includes('email')) return 'employeeEmail';
    if (clean.includes('role')) return 'role';
    if (clean.includes('tl')) return 'tl';
  }

  // Specific mappings for TideBT_CompanyData
  if (collectionName === 'TideBT_CompanyData') {
    if (clean === 'fsc' || clean === 'fse' || clean.includes('employee name') || clean.includes('fse name') || clean.includes('name')) return 'employeeName';
    if (clean.includes('onboarding status') || clean.includes('status') || clean.includes('opinion')) return 'onboardingStatus';
    if (clean.includes('merchant name') || clean.includes('merchant')) return 'merchantName';
    if (clean.includes('merchant number') || clean.includes('phone') || clean.includes('mobile')) return 'merchantNumber';
    if (clean.includes('date') || clean.includes('created')) return 'createdAt';
  }

  // Mappings for TideBT Form Response
  if (clean.includes('merchant name')) return 'merchantName';
  if (clean.includes('merchant number') || clean.includes('merchant mobile') || clean.includes('phone') || clean.includes('mobile') || clean === 'fsc') return 'merchantNumber';
  if (clean.includes('opinion')) return 'merchantOpinion';
  if (clean.includes('category')) return 'merchantCategory';
  if (clean.includes('onboarding status') || clean === 'status') return 'onboardingStatus';
  if (clean.includes('merchant email') || clean.includes('email id')) return 'merchantEmailId';
  
  if (clean.includes('transaction date') || clean === 'date') return 'transactionDate';
  if (clean.includes('included fee')) return 'withdrawAmountInclFee';
  if (clean.includes('withdraw amount') || clean.includes('amount')) return 'withdrawAmount';
  if (clean.includes('withdraw fee') || clean.includes('fees') || clean.includes('fee')) return 'withdrawFees';
  if (clean.includes('reason')) return 'reasonOfWithdraw';
  if (clean.includes('employee name') || clean.includes('fse name') || clean === 'fse') return 'employeeName';
  if (clean.includes('employee email') || clean.includes('fse email') || clean.includes('email address') || clean === 'email') return 'employeeEmail';
  if (clean.includes('form type') || clean.includes('type')) return 'formType';
  if (clean.includes('submitted by') || clean.includes('submitted')) return 'submittedBy';
  if (clean.includes('created at') || clean.includes('timestamp')) return 'createdAt';

  // Fallback camelCase conversion
  return clean.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
};

// Helper to get unique filter query for upserting
const getUniqueFilter = (doc, collectionName) => {
  if (collectionName === 'TideBT_Payments') {
    if (!doc.createdAt || !doc.transferTo || doc.amount === undefined || doc.amount === null) return null;
    return {
      createdAt: doc.createdAt,
      transferTo: doc.transferTo,
      amount: doc.amount
    };
  }
  if (collectionName === 'TideBT_RewardPass') {
    if (!doc.employeeName || !doc.dateOfWorking) return null;
    return {
      employeeName: doc.employeeName,
      dateOfWorking: doc.dateOfWorking
    };
  }
  if (collectionName === 'TideBT_Access') {
    if (!doc.tlName || !doc.fseName) return null;
    return {
      tlName: doc.tlName,
      fseName: doc.fseName
    };
  }
  return null;
};

// Main Run function
async function run() {
  console.log('🚀 Starting Google Sheets to MongoDB Sync...');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let sheetId = process.env.TIDEBT_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  let tabName = 'PT 8';
  let collectionName = 'TideBT_Access';
  let clearCollection = false;
  let incremental = false;
  let headerRow = 1;

  // Process arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sheet' && args[i + 1]) {
      sheetId = args[i + 1];
      i++;
    } else if (args[i] === '--tab' && args[i + 1]) {
      tabName = args[i + 1];
      i++;
    } else if (args[i] === '--collection' && args[i + 1]) {
      collectionName = args[i + 1];
      i++;
    } else if (args[i] === '--headerRow' && args[i + 1]) {
      headerRow = parseInt(args[i + 1]) || 1;
      i++;
    } else if (args[i] === '--clear') {
      clearCollection = true;
    } else if (args[i] === '--incremental') {
      incremental = true;
    }
  }

  // Fallback positional arguments if named ones aren't used fully
  if (args.length > 0 && !args.includes('--tab') && !args.includes('--collection')) {
    if (args[0] && !args[0].startsWith('--')) sheetId = args[0];
    if (args[1] && !args[1].startsWith('--')) tabName = args[1];
    if (args[2] && !args[2].startsWith('--')) collectionName = args[2];
    if (args.includes('--clear')) clearCollection = true;
    if (args.includes('--incremental')) incremental = true;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!sheetId) {
    console.error('❌ Error: Google Spreadsheet ID is missing. Set TIDEBT_SHEET_ID or GOOGLE_SHEET_ID in env, or pass as argument.');
    process.exit(1);
  }
  if (!mongoUri) {
    console.error('❌ Error: MongoDB Connection URI is missing. Set MONGODB_URI or MONGO_URI in env.');
    process.exit(1);
  }

  console.log(`📋 Target Configuration:`);
  console.log(`   Spreadsheet ID:  ${sheetId}`);
  console.log(`   Worksheet Tab:   "${tabName}"`);
  console.log(`   Header Row:      ${headerRow}`);
  console.log(`   Collection Name: "${collectionName}"`);
  console.log(`   Clear First:     ${clearCollection ? 'Yes' : 'No (Updates / Clean Slate by Sheet/Tab meta)'}`);
  console.log(`   Incremental:     ${incremental ? 'Yes' : 'No'}`);

  // 1. Authenticate with Google API
  let auth;
  try {
    if (!process.env.GOOGLE_CREDENTIALS_JSON) {
      throw new Error('GOOGLE_CREDENTIALS_JSON is not configured in environment variables.');
    }
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });
    console.log('✅ Google Authentication configured successfully.');
  } catch (error) {
    console.error('❌ Google Authentication configuration failed:', error.message);
    process.exit(1);
  }

  // 2. Fetch Google Sheets Data
  let rows = [];
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get list of worksheets to verify tab exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const availableTabs = meta.data.sheets.map(s => s.properties.title);
    
    if (!availableTabs.includes(tabName)) {
      console.error(`❌ Error: Tab "${tabName}" not found in spreadsheet.`);
      console.log('📋 Available tabs:');
      availableTabs.forEach(t => console.log(`   - ${t}`));
      process.exit(1);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:Z` // Fetch all rows, columns A through Z
    });

    rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log(`⚠️ Tab "${tabName}" is empty or has no data. Exiting.`);
      process.exit(0);
    }
    console.log(`📊 Retrieved ${rows.length} rows (including header) from Google Sheet.`);
  } catch (error) {
    if (error.message.includes('must not be an Office file') || error.message.includes('not supported') || error.message.includes('Requested entity was not found')) {
      console.log(`⚠️ Google Sheets API returned: "${error.message}".`);
      console.log(`🔄 Attempting to download and parse as Excel (.xlsx) file via Google Drive API...`);
      try {
        const drive = google.drive({ version: 'v3', auth });
        const driveResponse = await drive.files.get(
          { fileId: sheetId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        console.log(`✅ File downloaded from Drive. Size: ${driveResponse.data.byteLength} bytes`);
        const XLSX = require('xlsx');
        const workbook = XLSX.read(Buffer.from(driveResponse.data), { type: 'buffer' });
        
        if (!workbook.SheetNames.includes(tabName)) {
          console.error(`❌ Error: Tab "${tabName}" not found in Excel spreadsheet.`);
          console.log('📋 Available tabs:');
          workbook.SheetNames.forEach(t => console.log(`   - ${t}`));
          process.exit(1);
        }
        
        const sheet = workbook.Sheets[tabName];
        // Read sheet as 2D array to match Sheets API structure
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        // Remove trailing empty rows/cells to normalize
        while (rows.length > 0 && rows[rows.length - 1].every(cell => cell === '')) {
          rows.pop();
        }
        
        if (rows.length === 0) {
          console.log(`⚠️ Tab "${tabName}" is empty or has no data. Exiting.`);
          process.exit(0);
        }
        console.log(`📊 Retrieved ${rows.length} rows (including header) from Excel file via Drive API fallback.`);
      } catch (driveErr) {
        console.error('❌ Failed to fetch via Drive API fallback:', driveErr.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Failed to fetch Google Sheet data:', error.message);
      process.exit(1);
    }
  }

  // 3. Connect to MongoDB
  let db;
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'CompanyDB'
    });
    db = mongoose.connection.db;
    console.log(`✅ Connected to MongoDB. Database: "${mongoose.connection.name}"`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  // 4. Process Data based on Tab/Collection Type
  try {
    const collection = db.collection(collectionName);
    
    const headerRowIdx = headerRow - 1;
    if (headerRowIdx < 0 || headerRowIdx >= rows.length) {
      console.error(`❌ Error: Invalid --headerRow value ${headerRow}.`);
      process.exit(1);
    }
    const headers = rows[headerRowIdx].map(h => String(h).trim());
    const dataRows = rows.slice(headerRow);

    // Option to clear the entire collection explicitly
    if (clearCollection) {
      console.log(`🗑️ Clearing all documents in collection "${collectionName}"...`);
      const deleteResult = await collection.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deleted_count} documents.`);
    }

    if (collectionName === 'TideBT_Access' || tabName.toLowerCase() === 'pt 8') {
      // ===== SPECIAL PROCESSOR FOR ACCESS CONTROL ("PT 8") =====
      console.log(`⚙️ Running Access Control Sync for tab: "${tabName}"...`);
      
      const tlIndex = headers.findIndex(h => h.toLowerCase() === 'tl');
      const fseIndex = headers.findIndex(h => h.toLowerCase() === 'fsc' || h.toLowerCase() === 'fse');

      if (tlIndex === -1 || fseIndex === -1) {
        console.error('❌ Error: Expected columns "TL" and "FSC"/"FSE" not found in headers.');
        console.log('📋 Header columns found:', headers);
        process.exit(1);
      }

      const tlFsePairs = [];
      let currentTL = null;

      for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        const tlName = row[tlIndex] ? String(row[tlIndex]).trim() : '';
        const fseName = row[fseIndex] ? String(row[fseIndex]).trim() : '';

        // Carry forward the TL name if it exists on this row
        if (tlName) {
          currentTL = tlName;
        }

        // Add pair if we have an FSE name and a currently tracked TL
        if (fseName && currentTL) {
          tlFsePairs.push({
            tlName: currentTL,
            fseName: fseName,
            hasTideBTAccess: true,
            _syncedAt: new Date(),
            _sheet: 'Tide BT Access Sheet',
            _tab: tabName
          });
        }
      }

      console.log(`📋 Extracted ${tlFsePairs.length} FSE-TL Access Pairs.`);

      // If we didn't clear the whole collection, let's delete only those synced from this tab
      if (!clearCollection && !incremental) {
        console.log(`🗑️ Clearing old records from tab "${tabName}" in TideBT_Access...`);
        const delResult = await collection.deleteMany({ _tab: tabName });
        console.log(`✅ Deleted ${delResult.deleted_count} old records.`);
      }

      // Insert new records
      if (tlFsePairs.length > 0) {
        if (incremental) {
          console.log(`⚙️ Running Incremental Sync for Access Pairs...`);
          const operations = tlFsePairs.map(pair => {
            const filter = getUniqueFilter(pair, collectionName);
            return {
              updateOne: {
                filter: filter || { _id: new mongoose.Types.ObjectId() },
                update: { $set: pair },
                upsert: true
              }
            };
          });
          const result = await collection.bulkWrite(operations);
          console.log(`🎉 SUCCESS! Incremental write complete:`);
          console.log(`   Upserted: ${result.upsertedCount} new access pairs`);
          console.log(`   Matched:  ${result.matchedCount} existing (skipped)`);
        } else {
          const insertResult = await collection.insertMany(tlFsePairs);
          console.log(`🎉 SUCCESS! Inserted ${insertResult.insertedCount} access pairs into "${collectionName}".`);
        }
      } else {
        console.log('⚠️ No access pairs were extracted to sync.');
      }

    } else {
      // ===== GENERIC RECORD SYNCER (e.g. Tide BT Form Responses) =====
      console.log(`⚙️ Running Generic Document Sync for tab: "${tabName}" into "${collectionName}"...`);
      
      const mappedFields = headers.map(h => mapHeaderToField(h, collectionName));
      console.log(`📋 Header field mapping:`);
      headers.forEach((h, idx) => {
        console.log(`   "${h}" ──> "${mappedFields[idx]}"`);
      });

      const documents = [];
      let skippedCount = 0;

      for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        
        // Skip completely empty rows
        if (!row || row.every(val => !val || String(val).trim() === '')) {
          continue;
        }

        const doc = {};
        
        // Populate fields based on mapping
        mappedFields.forEach((field, colIdx) => {
          if (!field || field.trim() === '') return; // Skip empty header columns
          const rawVal = row[colIdx];
          if (rawVal === undefined || rawVal === null) return;
          const strVal = String(rawVal).trim();

          // Type casting/formatting based on field name
          if (['withdrawAmount', 'withdrawFees', 'amount', 'totalRPCount', 'totalBTAmount', 'rewardPassAmount', 'bankTransferFees'].includes(field)) {
            let val = parseNumber(strVal);
            if (collectionName === 'TideBT_RewardPass' && (field === 'totalBTAmount' || field === 'bankTransferFees')) {
              val = val / 100;
            }
            doc[field] = val;
          } else if (['transactionDate', 'createdAt', 'dateOfWorking'].includes(field)) {
            doc[field] = parseDate(strVal) || new Date();
          } else if (field === 'merchantNumber') {
            doc[field] = normalizePhone(strVal);
          } else {
            doc[field] = strVal;
          }
        });

        // Skip records that don't have basic required details (like merchantName or merchantNumber)
        if (collectionName.includes('Responses') && (!doc.merchantName || !doc.merchantNumber)) {
          skippedCount++;
          continue;
        }

        // Skip payments missing transferTo or amount
        if (collectionName === 'TideBT_Payments' && (!doc.transferTo || doc.amount === undefined || doc.amount === null)) {
          skippedCount++;
          continue;
        }

        // Skip reward passes missing employeeName or dateOfWorking
        if (collectionName === 'TideBT_RewardPass' && (!doc.employeeName || !doc.dateOfWorking)) {
          skippedCount++;
          continue;
        }

        // Skip completely empty documents (no mapped keys)
        if (Object.keys(doc).length === 0) {
          skippedCount++;
          continue;
        }

        // Add metadata
        doc._sheet = 'Tide BT Import';
        doc._tab = tabName;
        doc._syncedAt = new Date();
        
        // Auto-assign formType for Mobikwik sheet tab
        if (tabName.toLowerCase() === 'mk' || tabName.toLowerCase().includes('mobikwik')) {
          doc.formType = 'mobikwik-withdraw';
          doc.withdrawFees = Math.round((doc.withdrawAmount || 0) * 0.03 * 100) / 100;
          if (!doc.merchantOpinion) {
            doc.merchantOpinion = 'Ready For Onboarding';
          }
          if (!doc.merchantCategory) {
            doc.merchantCategory = 'Others';
          }
        }
        if (!doc.createdAt) {
          doc.createdAt = new Date();
        }

        documents.push(doc);
      }

      console.log(`📋 Processed rows: ${documents.length} successfully mapped, ${skippedCount} skipped.`);

      // Clean slate option for this tab/sheet label if not cleared entirely
      if (!clearCollection && !incremental) {
        console.log(`🗑️ Clearing old records matching tab "${tabName}" in "${collectionName}"...`);
        const delResult = await collection.deleteMany({ _tab: tabName });
        console.log(`✅ Deleted ${delResult.deleted_count} old documents.`);
      }

      // Bulk write
      if (documents.length > 0) {
        if (incremental) {
          console.log(`⚙️ Running Incremental Sync (inserting only new rows)...`);
          const operations = [];
          
          documents.forEach(doc => {
            const filter = getUniqueFilter(doc, collectionName);
            if (filter) {
              operations.push({
                updateOne: {
                  filter: filter,
                  update: { $set: doc },
                  upsert: true
                }
              });
            } else {
              skippedCount++;
            }
          });

          console.log(`📊 Total bulkWrite operations generated: ${operations.length}`);
          const emptyOps = operations.filter(op => !op.updateOne.update || Object.keys(op.updateOne.update.$setOnInsert || {}).length === 0);
          console.log(`⚠️ Operations with empty updates: ${emptyOps.length}`);
          if (emptyOps.length > 0) {
            console.log('Sample empty update operation:', JSON.stringify(emptyOps[0], null, 2));
          }

          if (operations.length > 0) {
            const result = await collection.bulkWrite(operations);
            console.log(`🎉 SUCCESS! Incremental write complete:`);
            console.log(`   Upserted: ${result.upsertedCount} new documents`);
            console.log(`   Matched:  ${result.matchedCount} existing (skipped)`);
          } else {
            console.log('⚠️ No new records to insert.');
          }
        } else {
          const insertResult = await collection.insertMany(documents);
          console.log(`🎉 SUCCESS! Inserted ${insertResult.insertedCount} documents into "${collectionName}".`);
        }
      } else {
        console.log('⚠️ No records to import.');
      }
    }

  } catch (error) {
    console.error('❌ Data processing and insertion failed:', error);
    if (error.writeErrors) {
      console.log('🔍 Write errors details:');
      console.log(JSON.stringify(error.writeErrors, null, 2));
    }
  } finally {
    // 5. Close connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed gracefully.');
  }
}

run().catch(err => {
  console.error('🔥 Fatal script error:', err);
  process.exit(1);
});
