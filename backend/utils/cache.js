const https = require('https');
const Redis = require('ioredis');

const UPSTASH_REST_HOST = 'distinct-magpie-119165.upstash.io';
const UPSTASH_REST_TOKEN = 'gQAAAAAAAdF9AAIgcDEyMDJmN2EyMWQ4ZWI0ZDU3OGFkN2VjOTc0MzJhMjM4OA';

let ioredisClient = null;
const memoryFallback = new Map();

function getIoRedis() {
  if (!ioredisClient && process.env.REDIS_URL) {
    try {
      ioredisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        enableReadyCheck: false,
        retryStrategy() { return 1000; }
      });
      ioredisClient.on('error', () => { ioredisClient = null; });
    } catch (e) {
      ioredisClient = null;
    }
  }
  return ioredisClient;
}

// Native HTTPS Upstash REST execution (100% compatible with all Node versions on Vercel)
function upstashRestCall(command, ...args) {
  return new Promise((resolve) => {
    try {
      const path = '/' + [command, ...args.map(a => encodeURIComponent(String(a)))].join('/');
      const options = {
        hostname: UPSTASH_REST_HOST,
        path: path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${UPSTASH_REST_TOKEN}`
        },
        timeout: 1500
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(body);
              resolve(parsed.result !== undefined ? parsed.result : null);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    } catch (err) {
      resolve(null);
    }
  });
}

const cacheKey = (...parts) => 'tidebt:' + parts.filter(Boolean).join(':');

const cacheGet = async (key) => {
  try {
    // 1. Try Upstash REST HTTPS
    const restVal = await upstashRestCall('get', key);
    if (restVal) {
      try { return JSON.parse(restVal); } catch (e) { return restVal; }
    }

    // 2. Try IoRedis TCP fallback
    const io = getIoRedis();
    if (io) {
      const data = await io.get(key);
      if (data) return JSON.parse(data);
    }

    // 3. Fallback to memory
    const mem = memoryFallback.get(key);
    if (mem && mem.expiry > Date.now()) return mem.data;
  } catch (err) {
    console.warn('cacheGet error:', err.message);
  }
  return null;
};

const cacheSet = async (key, data, ttlSeconds = 86400) => {
  try {
    const json = JSON.stringify(data);

    // 1. Upstash REST HTTPS
    upstashRestCall('set', key, json, 'EX', ttlSeconds).catch(() => {});

    // 2. IoRedis TCP
    const io = getIoRedis();
    if (io) {
      io.set(key, json, 'EX', ttlSeconds).catch(() => {});
    }

    // 3. In-memory
    memoryFallback.set(key, { data, expiry: Date.now() + (ttlSeconds * 1000) });
  } catch (err) {
    console.warn('cacheSet error:', err.message);
  }
};

const cacheInvalidatePattern = async (pattern) => {
  try {
    const io = getIoRedis();
    if (io) {
      const keys = await io.keys(pattern);
      if (keys.length > 0) await io.del(...keys);
    }
    for (const k of memoryFallback.keys()) {
      if (k.includes(pattern.replace('*', ''))) memoryFallback.delete(k);
    }
  } catch (err) {}
};

module.exports = {
  cacheKey,
  cacheGet,
  cacheSet,
  cacheInvalidatePattern
};
