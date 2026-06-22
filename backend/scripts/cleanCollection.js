/**
 * Database Collection Cleanup Utility
 * 
 * Usage:
 *   node scripts/cleanCollection.js <CollectionName>
 * 
 * Example:
 *   node scripts/cleanCollection.js TideBT_Payments
 *   node scripts/cleanCollection.js TideBT Form Responses
 */

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

async function run() {
  const args = process.argv.slice(2);
  let collectionName = '';
  let tabName = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tab' && args[i + 1]) {
      tabName = args[i + 1];
      i++;
    } else {
      if (collectionName) {
        collectionName += ' ' + args[i];
      } else {
        collectionName = args[i];
      }
    }
  }
  
  if (!collectionName || collectionName.trim() === '') {
    console.error('❌ Error: Please specify the collection name to clear.');
    console.log('   Example: node scripts/cleanCollection.js TideBT_Payments');
    console.log('   Example: node scripts/cleanCollection.js "TideBT Form Responses" --tab MK');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MongoDB connection URI is missing in .env (MONGODB_URI or MONGO_URI).');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'CompanyDB'
    });
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const exists = collections.some(col => col.name === collectionName);

    if (!exists) {
      console.warn(`⚠️ Warning: Collection "${collectionName}" does not exist in the database.`);
      console.log('Available collections:');
      collections.forEach(col => console.log(`   - ${col.name}`));
      process.exit(1);
    }

    const query = tabName ? { _tab: tabName } : {};
    if (tabName) {
      console.log(`🗑️ Clearing documents in collection "${collectionName}" with tab "${tabName}"...`);
    } else {
      console.log(`🗑️ Clearing all documents in collection "${collectionName}"...`);
    }
    const result = await db.collection(collectionName).deleteMany(query);
    console.log(`✅ SUCCESS! Deleted ${result.deletedCount} documents from "${collectionName}".`);

  } catch (error) {
    console.error('❌ Error during cleanup operation:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed gracefully.');
  }
}

run();
