// Palta KV store
// Uses Redis in production when REDIS_URL is available.
// Falls back to in-memory storage for development.

const Redis = require("ioredis");

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  redis.on("error", (err) => {
    console.error("[KV] Redis error:", err.message);
  });
}

const memory = new Map();

function memoryEntry(key) {
  const item = memory.get(key);

  if (!item) return null;

  if (item.expiresAt && item.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }

  return item;
}

function getStore() {
  return {
    async set(key, value, ttlSeconds) {
      if (redis) {
        await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
        return;
      }

      memory.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },

    async get(key) {
      if (redis) {
        const value = await redis.get(key);
        if (value === null) return null;

        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      const item = memoryEntry(key);
      return item ? item.value : null;
    },

    async del(key) {
      if (redis) {
        return redis.del(key);
      }

      memory.delete(key);
      return 1;
    },

    async incr(key, ttlSeconds = 60) {
      if (redis) {
        const count = await redis.incr(key);

        if (count === 1) {
          await redis.expire(key, ttlSeconds);
        }

        return count;
      }

      const item = memoryEntry(key);

      const count = item ? Number(item.value) + 1 : 1;

      memory.set(key, {
        value: count,
        expiresAt: item
          ? item.expiresAt
          : Date.now() + ttlSeconds * 1000,
      });

      return count;
    },

    async ttl(key) {
      if (redis) {
        return redis.ttl(key);
      }

      const item = memoryEntry(key);

      if (!item) return -2;

      return Math.max(
        0,
        Math.ceil((item.expiresAt - Date.now()) / 1000)
      );
    },
  };
}

module.exports = {
  getStore,
};
