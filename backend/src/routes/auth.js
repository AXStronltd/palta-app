// Auth routes — phone-based OTP login.
//
// DAY 2 NOTE: OTP is faked for development. request-otp returns the
// code directly in the response and logs it, so you can test without
// an SMS provider. On the day you pick a country + SMS gateway
// (Twilio, or a local provider), swap sendOtp() to actually send.

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { signToken } = require("../middleware/auth");

const router = express.Router();

// OTP store — now backed by the KV store (Redis in prod, memory in dev),
// so codes survive restarts and are shared across server instances.
const { getStore } = require("../services/kv");
const kv = getStore();

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const otpKey = (phone) => `otp:${phone}`;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function sendOtp(phone, code, country) {
  // Route through the country's SMS provider (mock in dev — logs instead
  // of sending, and the code is still returned as devCode below).
  try {
    const { smsFor } = require("../config/resolver");
    const sms = smsFor(country);
    await sms.send({ to: phone, body: `Your Palta code is ${code}` });
  } catch (err) {
    console.log(`[OTP fallback] ${phone} -> ${code} (${err.message})`);
  }
}

const phoneSchema = z.object({
  phone: z.string().min(6).max(20),
  country: z.string().length(2).optional(),
});

const verifySchema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().length(6),
  name: z.string().min(1).max(80).optional(),
  country: z.string().length(2).optional(),
  // DEV: role is self-selected at signup for convenience. In PRODUCTION,
  // only CUSTOMER/DRIVER should be self-assignable; RESTAURANT and ADMIN
  // must be granted by an existing admin (the seed pre-creates them).
  role: z.enum(["CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).optional(),
});

// POST /auth/request-otp  { phone }
const { rateLimit } = require("../middleware/rateLimit");

// Limit OTP requests: max 5 per phone per 10 min (stops SMS-bombing a number)
const otpRequestLimit = rateLimit({
  windowSeconds: 600, max: 5, keyPrefix: "otp-req",
  keyFn: (req) => (req.body?.phone || "nophone"),
});
// Limit verify attempts: max 10 per IP per 10 min (stops code brute-force)
const verifyLimit = rateLimit({ windowSeconds: 600, max: 10, keyPrefix: "otp-verify" });

router.post("/request-otp", otpRequestLimit, async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid phone required" });

  const { phone, country } = parsed.data;
  const code = generateOtp();
  await kv.set(otpKey(phone), code, OTP_TTL_SECONDS);
  await sendOtp(phone, code, country);

  // DEV convenience: return the code so the app can auto-fill.
  // REMOVE `devCode` before production.
  res.json({ sent: true, devCode: code });
});

// POST /auth/verify  { phone, code, name?, role? }
router.post("/verify", verifyLimit, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "phone and 6-digit code required" });

  const { phone, code, name, role, country } = parsed.data;
  const storedCode = await kv.get(otpKey(phone));

  // A missing code means never-requested OR expired (KV TTL removes it).
  if (!storedCode) {
    return res.status(401).json({ error: "Code expired or not found, request a new one" });
  }
  if (String(storedCode) !== code) {
    return res.status(401).json({ error: "Incorrect code" });
  }
  await kv.del(otpKey(phone)); // one-time use

  // Find or create the user.
  let user = await prisma.user.findUnique({ where: { phone } });
  let isNew = false;
  if (!user) {
    user = await prisma.user.create({
      data: { phone, name: name || null, role: role || "CUSTOMER", country: (country || "AE").toUpperCase() },
    });
    isNew = true;
  }

  const token = signToken({ userId: user.id, role: user.role, country: user.country });
  res.json({ token, user, isNew });
});

// GET /auth/me  (requires token) — handy for the app to restore session
const { requireAuth } = require("../middleware/auth");
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

// POST /auth/push-token  { token }  (register device for push)
router.post("/push-token", requireAuth, async (req, res) => {
  const token = (req.body?.token || "").toString();
  if (!token) return res.status(400).json({ error: "token required" });
  await prisma.user.update({ where: { id: req.user.userId }, data: { pushToken: token } });
  res.json({ ok: true });
});

module.exports = router;
