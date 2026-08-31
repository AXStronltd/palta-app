// AI routes. Day 1: a single /ai/ping that proves the LLM layer
// is wired up correctly. Day 2 adds the conversational ordering
// endpoint here.

const express = require("express");
const { z } = require("zod");
const { complete } = require("../ai/client");
const { runOrderingTurn } = require("../ai/ordering");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const pingSchema = z.object({
  message: z.string().min(1).max(500),
});

// POST /ai/ping  { message } -> real LLM reply
router.post("/ping", async (req, res) => {
  const parsed = pingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const reply = await complete({
      system:
        "You are Palta's assistant, a friendly food-delivery helper. Keep replies to one short sentence.",
      messages: [{ role: "user", content: parsed.data.message }],
      maxTokens: 100,
    });
    res.json({ reply });
  } catch (err) {
    console.error("[/ai/ping] error:", err.message);
    res.status(500).json({ error: "AI layer failed", detail: err.message });
  }
});

// POST /ai/order — one turn of conversational ordering.
// body: { restaurantId, message, history? }
// returns: { reply, cart, subtotal }
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

router.post("/order", requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "restaurantId and message are required" });
  }

  try {
    const { restaurantId, message, history } = parsed.data;
    const result = await runOrderingTurn({
      restaurantId,
      history,
      userMessage: message,
    });
    res.json(result);
  } catch (err) {
    console.error("[/ai/order] error:", err.message);
    res.status(500).json({ error: "Ordering failed", detail: err.message });
  }
});

module.exports = router;
