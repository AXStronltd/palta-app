// ============================================================
// Palta Authentication Routes
// Phone + OTP authentication
// ============================================================

const express = require("express");
const { z } = require("zod");

const { prisma } = require("../prisma");
const { signToken, requireAuth } = require("../middleware/auth");
const { getStore } = require("../services/kv");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

const kv = getStore();

const OTP_TTL_SECONDS = 5 * 60;

const otpKey = (phone) => `otp:${phone}`;

// ============================================================
// OTP GENERATION
// ============================================================

function generateOtp() {
  return String(
    Math.floor(100000 + Math.random() * 900000)
  );
}

// ============================================================
// SMS
// ============================================================
//
// In development, if the SMS resolver is unavailable,
// the OTP is logged instead of crashing the request.
//
// In production, connect your real SMS provider here.
// ============================================================

async function sendOtp(phone, code, country) {
  try {
    const { smsFor } = require("../config/resolver");

    const sms = smsFor(
      country ? country.toUpperCase() : "AE"
    );

    await sms.send({
      to: phone,
      body: `Your Palta verification code is ${code}`,
    });

    console.log(`[OTP] SMS sent to ${phone}`);
  } catch (err) {
    console.log(
      `[OTP fallback] ${phone} -> ${code} (${err.message})`
    );
  }
}

// ============================================================
// VALIDATION
// ============================================================

const phoneSchema = z.object({
  phone: z.string().min(6).max(20),
  country: z.string().length(2).optional(),
});

const verifySchema = z.object({
  phone: z.string().min(6).max(20),

  code: z.string().length(6),

  name: z.string().min(1).max(80).optional(),

  country: z.string().length(2).optional(),

  role: z
    .enum([
      "CUSTOMER",
      "DRIVER",
      "RESTAURANT",
      "ADMIN",
    ])
    .optional(),
});

// ============================================================
// RATE LIMITING
// ============================================================

// Maximum 5 OTP requests per phone every 10 minutes.
const otpRequestLimit = rateLimit({
  windowSeconds: 600,
  max: 5,
  keyPrefix: "otp-req",

  keyFn: (req) =>
    String(req.body?.phone || "nophone"),
});

// Maximum 10 verification attempts per IP every 10 minutes.
const verifyLimit = rateLimit({
  windowSeconds: 600,
  max: 10,
  keyPrefix: "otp-verify",
});

// ============================================================
// POST /auth/request-otp
// ============================================================

router.post(
  "/request-otp",
  otpRequestLimit,
  async (req, res) => {
    const parsed = phoneSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Valid phone required",
      });
    }

    try {
      const {
        phone,
        country,
      } = parsed.data;

      const code = generateOtp();

      // Store OTP for 5 minutes.
      await kv.set(
        otpKey(phone),
        code,
        OTP_TTL_SECONDS
      );

      // Send SMS.
      await sendOtp(
        phone,
        code,
        country
      );

      // --------------------------------------------------------
      // DEVELOPMENT ONLY
      // Remove devCode before production.
      // --------------------------------------------------------

      const response = {
        sent: true,
      };

      if (
        process.env.NODE_ENV !== "production"
      ) {
        response.devCode = code;
      }

      return res.json(response);
    } catch (err) {
      console.error(
        "[/auth/request-otp]",
        err
      );

      return res.status(500).json({
        error: "Unable to send verification code",
      });
    }
  }
);

// ============================================================
// POST /auth/verify
// ============================================================

router.post(
  "/verify",
  verifyLimit,
  async (req, res) => {
    const parsed = verifySchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "phone and 6-digit code required",
      });
    }

    try {
      const {
        phone,
        code,
        name,
        role,
        country,
      } = parsed.data;

      // --------------------------------------------------------
      // Retrieve OTP
      // --------------------------------------------------------

      const storedCode = await kv.get(
        otpKey(phone)
      );

      if (!storedCode) {
        return res.status(401).json({
          error:
            "Code expired or not found, request a new one",
        });
      }

      if (
        String(storedCode) !==
        String(code)
      ) {
        return res.status(401).json({
          error: "Incorrect code",
        });
      }

      // --------------------------------------------------------
      // One-time use
      // --------------------------------------------------------

      await kv.del(otpKey(phone));

      // --------------------------------------------------------
      // Find existing user
      // --------------------------------------------------------

      let user =
        await prisma.user.findUnique({
          where: {
            phone,
          },
        });

      let isNew = false;

      // --------------------------------------------------------
      // Create user
      // --------------------------------------------------------

      if (!user) {
        user =
          await prisma.user.create({
            data: {
              phone,

              name:
                name ||
                null,

              role:
                role ||
                "CUSTOMER",

              country:
                (
                  country ||
                  "AE"
                ).toUpperCase(),
            },
          });

        isNew = true;
      }

      // --------------------------------------------------------
      // Create authentication token
      // --------------------------------------------------------

      const token = signToken({
        userId: user.id,
        role: user.role,
        country: user.country,
      });

      return res.json({
        token,
        user,
        isNew,
      });
    } catch (err) {
      console.error(
        "[/auth/verify]",
        err
      );

      return res.status(500).json({
        error: "Authentication failed",
      });
    }
  }
);

// ============================================================
// GET /auth/me
// ============================================================

router.get(
  "/me",
  requireAuth,
  async (req, res) => {
    try {
      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user.userId,
          },
        });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      return res.json({
        user,
      });
    } catch (err) {
      console.error(
        "[/auth/me]",
        err
      );

      return res.status(500).json({
        error: "Unable to load user",
      });
    }
  }
);

// ============================================================
// POST /auth/push-token
// ============================================================

router.post(
  "/push-token",
  requireAuth,
  async (req, res) => {
    try {
      const token =
        req.body?.token
          ?.toString()
          .trim();

      if (!token) {
        return res.status(400).json({
          error: "token required",
        });
      }

      await prisma.user.update({
        where: {
          id: req.user.userId,
        },

        data: {
          pushToken: token,
        },
      });

      return res.json({
        ok: true,
      });
    } catch (err) {
      console.error(
        "[/auth/push-token]",
        err
      );

      return res.status(500).json({
        error:
          "Unable to register push token",
      });
    }
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
