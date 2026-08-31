// Request-context middleware. Assigns each request a short id, exposes it
// on req + the X-Request-Id response header, and logs one line per request
// with method, path, status, and duration.

const crypto = require("crypto");
const { logger } = require("../services/logger");

function requestContext(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomBytes(6).toString("hex");
  res.set("X-Request-Id", req.id);
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
      reqId: req.id, ms, status: res.statusCode,
    });
  });

  next();
}

module.exports = { requestContext };
