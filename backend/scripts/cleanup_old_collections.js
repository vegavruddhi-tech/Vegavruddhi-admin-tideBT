/**
 * Deletes old/duplicate BT collections that are causing wrong data to be picked.
 * Keeps only the canonical collections.
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Collections to DELETE (old/wrong ones)
const TO_DELETE = [
  'bt_tl_connect_july',      // empty, wrong - canonical is 'bt_tl_connect july'
  'bt_tl_connect_may',       // empty, wrong - canonical is 'BT_TL_CONNECT MAY'
  'bt_tl_connect_june',      // empty, wrong - canonical is 'BT_TL_CONNECT JUNE'
  'bt_tl_connect_april',     // empty, wrong - canonical is 'BT_TL_CONNECT APRIL'
  'bt_tl_connect_feb',       // empty, wrong - canonical is 'BT_TL_CONNECT FEB'
  'bt_tl_connect_march',     // empty, wrong - canonical is 'BT_TL_CONNECT MARCH'
  'BT_TL_CONNECT FEB 26',    // old Feb with "26" suffix - canonical is 'BT_TL_CONNECT FEB'
  'BT_TL_CONNECT JAN 26',    // old Jan with "26" suffix - canonical is 'BT_TL_CONNECT JAN'
  'tl_connect_march', 'tl_connect_feb', 'tl_connect_june',
  'tl_connect_april', 'tl_connect_may', 'tl_connect_july',
  'TL_connect_March', 'TL_connect_Feb', 'TL_CONNECT_FEB26',
  'TL_CONNECT_MARCH', 'Jan26_Tl_connect',
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CompanyDB' });
  const db = mongoose.connection.db;

  const existing = (await db.listCollections().toArray()).map(c => c.name);

  for (const col of TO_DELETE) {
    if (existing.includes(col)) {
      const count = await db.collection(col).countDocuments();
      await db.collection(col).drop();
      console.log(`✅ Dropped "${col}" (${count} docs)`);
    } else {
      console.log(`⏭ Skipped "${col}" (does not exist)`);
    }
  }

  // Show remaining BT collections
  const remaining = (await db.listCollections().toArray()).map(c => c.name)
    .filter(c => c.toUpperCase().includes('TL_CONNECT') || c.toUpperCase().includes('BT_TL'));
  console.log('\n✅ Remaining BT collections:', remaining);

  // Clear cache
  const r = await db.collection('TideBT_SummaryCache').deleteMany({});
  console.log('\n🗑️  Cache cleared:', r.deletedCount, 'entries');

  await mongoose.connection.close();
  console.log('\nDone!');
}
run().catch(e => console.error(e.message));
