// Health checks — liveness (is the process up?) and readiness (are its
// dependencies reachable?). Kubernetes/most hosts use these for routing.

const express = require("express");
const { prisma } = require("../prisma");
const { getStore } = require("../services/kv");

const router = express.Router();
const kv = getStore();

// GET /health — liveness. Cheap; just proves the process responds.
router.get("/", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// GET /health/ready — readiness. Checks DB + KV; 503 if a dep is down so
// the load balancer stops sending traffic to this instance.
router.get("/ready", async (_req, res) => {
  const checks = { db: "ok", kv: "ok" };

  try { await prisma.$queryRaw`SELECT 1`; }
  catch { checks.db = "unreachable"; }

  try {
    await kv.set("health:ping", "1", 5);
    const v = await kv.get("health:ping");
    if (v !== "1") checks.kv = "degraded";
  } catch { checks.kv = "unreachable"; }

  const healthy = Object.values(checks).every((v) => v === "ok");
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ready" : "not-ready",
    time: new Date().toISOString(),
    checks,
  });
});

module.exports = router;
