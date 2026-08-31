// Rate limiter — KV-backed (Redis in prod), so limits hold across all
// server instances, not just one process. Sliding fixed-window counter.
//
// Usage: rateLimit({ windowSeconds, max, keyPrefix })
//   Keys off client IP by default; pass keyFn to key off something else
//   (e.g. phone for OTP requests, so one number can't spam codes).

const { getStore } = require("../services/kv");
const kv = getStore();

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket?.remoteAddress
    || "unknown";
}

function rateLimit({ windowSeconds = 60, max = 30, keyPrefix = "rl", keyFn } = {}) {
  return async function (req, res, next) {
    try {
      const id = keyFn ? keyFn(req) : clientIp(req);
      const key = `${keyPrefix}:${id}`;
      const count = await kv.incr(key, windowSeconds);
      if (count > max) {
        const retry = await kv.ttl(key);
        res.set("Retry-After", String(retry > 0 ? retry : windowSeconds));
        return res.status(429).json({ error: "Too many requests, please slow down." });
      }
      // Surface remaining budget (handy for clients).
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      next();
    } catch {
      // Fail open — a limiter outage must not take down the API.
      next();
    }
  };
}

module.exports = { rateLimit, clientIp };
