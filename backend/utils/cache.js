const Redis = require('ioredis');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

let redis = null;
const TTL_SECONDS = 600; // 10 minutes

function getRedis() {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 3000,
    });
    redis.on('error', () => {});
  }
  return redis;
}

async function cacheGet(key) {
  try {
    const r = getRedis();
    const val = await r.getBuffer(key);
    if (!val) return null;
    // Try decompress (gzipped), fallback to plain JSON
    try {
      const decompressed = await gunzip(val);
      return JSON.parse(decompressed.toString());
    } catch {
      return JSON.parse(val.toString());
    }
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttl = TTL_SECONDS) {
  try {
    const r = getRedis();
    const json = JSON.stringify(value);
    // Compress if > 10KB
    if (json.length > 10240) {
      const compressed = await gzip(Buffer.from(json));
      await r.setexBuffer(key, ttl, compressed);
    } else {
      await r.setex(key, ttl, json);
    }
  } catch {}
}

async function cacheInvalidate(pattern) {
  try {
    const r = getRedis();
    const keys = await r.keys(pattern);
    if (keys.length > 0) await r.del(...keys);
  } catch {}
}

function cacheKey(...parts) {
  return parts.filter(Boolean).join(':').replace(/\s+/g, '_').toUpperCase();
}

module.exports = { cacheGet, cacheSet, cacheInvalidate, cacheKey };
