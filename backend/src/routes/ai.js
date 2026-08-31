// ============================================================
// Palta AI Routes
// ============================================================
// Provides:
//   POST /ai/ping
//   POST /ai/order
//
// /ai/ping:
//   Simple LLM connectivity test.
//
// /ai/order:
//   Conversational restaurant ordering.
//   The ordering engine only selects real menu items.
// ============================================================

const express = require("express");
const { z } = require("zod");

const { complete } = require("../ai/client");
const { runOrderingTurn } = require("../ai/ordering");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ============================================================
// AI PING
// ============================================================

const pingSchema = z.object({
  message: z.string().min(1).max(500),
});

// POST /ai/ping
// Body:
// {
//   "message": "Hello Palta"
// }
//
// Response:
// {
//   "reply": "Hello! How can I help you today?"
// }

router.post("/ping", async (req, res) => {
  const parsed = pingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "message is required",
    });
  }

  try {
    const reply = await complete({
      system:
        "You are Palta's assistant, a friendly food-delivery helper. Keep replies to one short sentence.",

      messages: [
        {
          role: "user",
          content: parsed.data.message,
        },
      ],

      maxTokens: 100,
    });

    return res.json({
      reply,
    });
  } catch (err) {
    console.error("[/ai/ping] error:", err.message);

    return res.status(500).json({
      error: "AI layer failed",
      detail: err.message,
    });
  }
});

// ============================================================
// CONVERSATIONAL ORDERING
// ============================================================

const orderSchema = z.object({
  restaurantId: z.string().min(1),

  message: z.string().min(1).max(500),

  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

// POST /ai/order
//
// Body:
//
// {
//   "restaurantId": "restaurant-id",
//   "message": "I want a burger under $15",
//   "history": []
// }
//
// Response:
//
// {
//   "reply": "...",
//   "cart": [...],
//   "subtotal": 12.99
// }

router.post("/order", requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "restaurantId and message are required",
    });
  }

  try {
    const {
      restaurantId,
      message,
      history,
    } = parsed.data;

    const result = await runOrderingTurn({
      restaurantId,
      history,
      userMessage: message,
    });

    return res.json(result);
  } catch (err) {
    console.error("[/ai/order] error:", err.message);

    return res.status(500).json({
      error: "Ordering failed",
      detail: err.message,
    });
  }
});

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
