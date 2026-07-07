/**
 * cache.js — MongoDB-backed permanent cache (invalidate-on-write)
 *
 * IMPORTANT: Pass `db` (req.db) explicitly to every function.
 * Do NOT rely on mongoose.connection.db — it doesn't work reliably on Vercel serverless.
 *
 * Usage:
 *   const { cacheGet, cacheSet, cacheInvalidate, cacheKey } = require('../utils/cache');
 *   const cached = await cacheGet(db, ck);
 *   await cacheSet(db, ck, result);
 *   await cacheInvalidate(db, '*');
 */

const CACHE_COLLECTION = 'TideBT_SummaryCache';

// ── cacheGet ───────────────────────────────────────────────────────────────
async function cacheGet(db, key) {
  if (!db) return null;
  try {
    const doc = await db.collection(CACHE_COLLECTION).findOne({ cacheKey: key });
    if (!doc) return null;
    console.log(`⚡ [Cache HIT] ${key}`);
    return doc.data || null;
  } catch (e) {
    console.warn(`⚠️ [Cache] Read failed (non-fatal): ${e.message}`);
    return null;
  }
}

// ── cacheSet ───────────────────────────────────────────────────────────────
// Permanent — no TTL. Cleared only via cacheInvalidate().
async function cacheSet(db, key, value) {
  if (!db) return;
  try {
    await db.collection(CACHE_COLLECTION).updateOne(
      { cacheKey: key },
      { $set: { cacheKey: key, data: value, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log(`💾 [Cache] Written: ${key}`);
  } catch (e) {
    console.warn(`⚠️ [Cache] Write failed (non-fatal): ${e.message}`);
  }
}

// ── cacheInvalidate ────────────────────────────────────────────────────────
// pattern: '*' clears all, or a prefix like 'FSE_*'
async function cacheInvalidate(db, pattern) {
  if (!db) return;
  try {
    let result;
    if (!pattern || pattern === '*') {
      result = await db.collection(CACHE_COLLECTION).deleteMany({});
    } else {
      const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      result = await db.collection(CACHE_COLLECTION).deleteMany({
        cacheKey: { $regex: new RegExp(regexStr, 'i') }
      });
    }
    console.log(`🗑️ [Cache] Invalidated "${pattern}" — ${result.deletedCount} entries cleared`);
  } catch (e) {
    console.warn(`⚠️ [Cache] Invalidate failed (non-fatal): ${e.message}`);
  }
}

// ── cacheKey ───────────────────────────────────────────────────────────────
function cacheKey(...parts) {
  return parts
    .filter(p => p !== undefined && p !== null)
    .join(':')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

module.exports = { cacheGet, cacheSet, cacheInvalidate, cacheKey };
