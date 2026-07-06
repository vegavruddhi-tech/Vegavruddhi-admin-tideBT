/**
 * cache.js — Permanent MongoDB-backed cache (invalidate-on-write)
 *
 * Strategy:
 *  - Cache lives forever — no TTL expiry by time.
 *  - Cache is busted explicitly when data changes (new payment, sync, etc.).
 *  - Past months are cached once and never expire (data is immutable).
 *  - Current month cache is busted whenever a write happens.
 *
 * Falls back to Redis if REDIS_HOST is configured, otherwise uses MongoDB.
 * All errors are swallowed — cache failure never breaks the API.
 */

const zlib = require('zlib');
const { promisify } = require('util');

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const CACHE_COLLECTION = 'TideBT_SummaryCache';

// ── Redis (optional, used only if REDIS_HOST is set) ──────────────────────
let redis = null;

function getRedis() {
  if (!process.env.REDIS_HOST) return null;
  if (!redis) {
    try {
      const Redis = require('ioredis');
      redis = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        retryStrategy: () => null,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        commandTimeout: 3000,
      });
      redis.on('error', () => {});
    } catch {
      redis = null;
    }
  }
  return redis;
}

// ── MongoDB db reference (injected by middleware) ──────────────────────────
// We grab it from the global mongoose connection so cache.js doesn't need req.db
let _getDb = null;

function setDbGetter(fn) {
  _getDb = fn;
}

function getDb() {
  if (_getDb) return _getDb();
  try {
    const mongoose = require('mongoose');
    return mongoose.connection.readyState === 1 ? mongoose.connection.db : null;
  } catch {
    return null;
  }
}

// ── cacheGet ───────────────────────────────────────────────────────────────
async function cacheGet(key) {
  // Try Redis first
  const r = getRedis();
  if (r) {
    try {
      const val = await r.getBuffer(key);
      if (val) {
        try {
          const decompressed = await gunzip(val);
          return JSON.parse(decompressed.toString());
        } catch {
          return JSON.parse(val.toString());
        }
      }
    } catch {}
  }

  // Fall back to MongoDB
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await db.collection(CACHE_COLLECTION).findOne({ cacheKey: key });
    if (!doc) return null;
    // Decompress if stored as gzipped buffer
    if (doc.compressed && doc.data) {
      try {
        const buf = Buffer.from(doc.data.buffer || doc.data);
        const decompressed = await gunzip(buf);
        return JSON.parse(decompressed.toString());
      } catch {}
    }
    return doc.data || null;
  } catch {
    return null;
  }
}

// ── cacheSet ───────────────────────────────────────────────────────────────
// ttl: seconds (only used for Redis). Pass 0 for permanent.
// MongoDB entries are always permanent — cleared via cacheInvalidate().
async function cacheSet(key, value, ttl = 0) {
  // Try Redis first
  const r = getRedis();
  if (r) {
    try {
      const json = JSON.stringify(value);
      if (json.length > 10240) {
        const compressed = await gzip(Buffer.from(json));
        if (ttl > 0) {
          await r.setexBuffer(key, ttl, compressed);
        } else {
          await r.setBuffer(key, compressed);
        }
      } else {
        if (ttl > 0) {
          await r.setex(key, ttl, json);
        } else {
          await r.set(key, json);
        }
      }
    } catch {}
  }

  // Always also write to MongoDB (permanent store)
  try {
    const db = getDb();
    if (!db) return;
    const json = JSON.stringify(value);
    let storeData = value;
    let compressed = false;
    // Compress large payloads
    if (json.length > 10240) {
      try {
        const buf = await gzip(Buffer.from(json));
        storeData = buf;
        compressed = true;
      } catch {}
    }
    await db.collection(CACHE_COLLECTION).updateOne(
      { cacheKey: key },
      { $set: { cacheKey: key, data: storeData, compressed, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log(`💾 [Cache] Written: ${key}`);
  } catch (e) {
    console.warn(`⚠️ [Cache] Write failed (non-fatal): ${e.message}`);
  }
}

// ── cacheInvalidate ────────────────────────────────────────────────────────
// pattern: glob-style string e.g. 'FSE_*' or '*' for all
async function cacheInvalidate(pattern) {
  // Redis invalidate
  const r = getRedis();
  if (r) {
    try {
      const keys = await r.keys(pattern);
      if (keys.length > 0) await r.del(...keys);
    } catch {}
  }

  // MongoDB invalidate
  try {
    const db = getDb();
    if (!db) return;
    let result;
    if (pattern === '*') {
      result = await db.collection(CACHE_COLLECTION).deleteMany({});
    } else {
      // Convert glob pattern to regex: FSE_* → /^FSE_/
      const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      result = await db.collection(CACHE_COLLECTION).deleteMany({
        cacheKey: { $regex: new RegExp(regexStr, 'i') }
      });
    }
    console.log(`🗑️ [Cache] Invalidated pattern "${pattern}" — ${result.deletedCount} entries cleared`);
  } catch (e) {
    console.warn(`⚠️ [Cache] Invalidate failed (non-fatal): ${e.message}`);
  }
}

// ── cacheKey ───────────────────────────────────────────────────────────────
function cacheKey(...parts) {
  return parts.filter(p => p !== undefined && p !== null).join(':').replace(/\s+/g, '_').toUpperCase();
}

module.exports = { cacheGet, cacheSet, cacheInvalidate, cacheKey, setDbGetter };
