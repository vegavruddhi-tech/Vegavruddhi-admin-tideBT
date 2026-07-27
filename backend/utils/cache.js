/**
 * cache.js — Two-layer cache: in-memory (instant) + MongoDB (persistent)
 *
 * Layer 1: In-memory Map — sub-millisecond reads within same serverless instance
 * Layer 2: MongoDB TideBT_SummaryCache — persists across cold starts
 * TTL: 30 minutes (auto-expire so BT sync data shows without manual clear)
 *
 * Usage:
 *   const { cacheGet, cacheSet, cacheInvalidate, cacheKey } = require('../utils/cache');
 *   const cached = await cacheGet(db, ck);
 *   await cacheSet(db, ck, result);
 *   await cacheInvalidate(db, '*');
 */

const CACHE_COLLECTION = 'TideBT_SummaryCache';
const AGE_MS = 30 * 60 * 1000; // 30 minutes TTL

// ── In-memory cache (Layer 1) ──────────────────────────────────────────────
const memCache = new Map(); // key → { data, ts }

function memGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > AGE_MS) { memCache.delete(key); return null; }
  return entry.data;
}

function memSet(key, value) {
  memCache.set(key, { data: value, ts: Date.now() });
}

function memDel(pattern) {
  if (!pattern || pattern === '*') {
    memCache.clear();
    return;
  }
  const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
  for (const k of memCache.keys()) {
    if (regex.test(k)) memCache.delete(k);
  }
}

// ── cacheGet ───────────────────────────────────────────────────────────────
async function cacheGet(db, key) {
  // Layer 1: in-memory (instant)
  const mem = memGet(key);
  if (mem !== null) {
    console.log(`⚡ [MemCache HIT] ${key}`);
    return mem;
  }

  // Layer 2: MongoDB
  if (!db) return null;
  try {
    const doc = await db.collection(CACHE_COLLECTION).findOne({ cacheKey: key });
    if (!doc) return null;
    if (doc.updatedAt && (Date.now() - new Date(doc.updatedAt).getTime()) > AGE_MS) {
      console.log(`⏰ [Cache EXPIRED] ${key}`);
      await db.collection(CACHE_COLLECTION).deleteOne({ cacheKey: key });
      return null;
    }
    // Warm the in-memory cache from MongoDB
    if (doc.data) memSet(key, doc.data);
    console.log(`⚡ [MongoDB Cache HIT] ${key}`);
    return doc.data || null;
  } catch (e) {
    console.warn(`⚠️ [Cache] Read failed (non-fatal): ${e.message}`);
    return null;
  }
}

// ── cacheSet ───────────────────────────────────────────────────────────────
async function cacheSet(db, key, value) {
  // Write to both layers
  memSet(key, value);

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
async function cacheInvalidate(db, pattern) {
  // Clear both layers
  memDel(pattern);

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
