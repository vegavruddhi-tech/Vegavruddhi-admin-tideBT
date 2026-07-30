const Redis = require('ioredis');

let redis = null;
const memoryFallback = new Map();

function getRedis() {
  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
          return Math.min(times * 50, 2000);
        }
      });
      redis.on('connect', () => console.log('⚡ Connected to Upstash Redis'));
      redis.on('error', (err) => console.warn('⚠️ Upstash Redis error (fallback active):', err.message));
    } catch (e) {
      console.warn('⚠️ Failed to initialize Redis:', e.message);
      redis = null;
    }
  }
  return redis;
}

const cacheKey = (...parts) => 'tidebt:' + parts.filter(Boolean).join(':');

const cacheGet = async (key) => {
  const client = getRedis();
  if (client) {
    try {
      const data = await client.get(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Redis get error:', e.message);
    }
  }
  // Fallback memory check
  const mem = memoryFallback.get(key);
  if (mem && mem.expiry > Date.now()) return mem.data;
  return null;
};

const cacheSet = async (key, data, ttlSeconds = 300) => {
  const client = getRedis();
  const json = JSON.stringify(data);
  if (client) {
    try {
      await client.set(key, json, 'EX', ttlSeconds);
    } catch (e) {
      console.warn('Redis set error:', e.message);
    }
  }
  memoryFallback.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
};

const cacheInvalidatePattern = async (pattern) => {
  const client = getRedis();
  if (client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) await client.del(...keys);
    } catch (e) {
      console.warn('Redis del error:', e.message);
    }
  }
  for (const k of memoryFallback.keys()) {
    if (k.includes(pattern.replace('*', ''))) memoryFallback.delete(k);
  }
};

module.exports = {
  cacheKey,
  cacheGet,
  cacheSet,
  cacheInvalidatePattern
};
