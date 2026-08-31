// ============================================================
// Conversational ordering engine
// ============================================================
//
// Turns natural language ("something under $15, no seafood, for two")
// into a verified cart of REAL menu items.
//
// GROUNDING RULE (from Day 1): the AI may only ever select items that
// exist in the menu we pass it. It cannot invent dishes or prices.
// We enforce this twice:
//   1. In the prompt — it's told to only use provided items by id.
//   2. In code — after the AI replies, every chosen id is validated
//      against the real menu. Unknown ids are dropped.
// ============================================================

const { complete } = require("../client");
const { prisma } = require("../prisma");

/**
 * Build the system prompt. The live menu is injected as structured
 * context so the model is grounded in real, in-stock items only.
 */
function buildSystemPrompt(restaurant, menu) {
  const menuLines = menu
    .map(
      (m) =>
        `- id:${m.id} | ${m.name} | $${m.price.toFixed(2)} | ${m.category}` +
        (m.description ? ` | ${m.description}` : "")
    )
    .join("\n");

  return `You are Palta's ordering assistant for "${restaurant.name}".
Your job: understand what the customer wants and pick matching items
FROM THE MENU BELOW ONLY. Never invent dishes, prices, or restaurants.

MENU (only these exist — use the exact id):
${menuLines}

Rules:
- Only choose items whose id appears above.
- Respect constraints (budget, dietary, quantity, "no X").
- If nothing fits, say so and suggest the closest real option.
- Keep replies short and friendly.

Respond with a JSON object ONLY, no markdown, in this exact shape:
{
  "reply": "one short friendly sentence to the customer",
  "cart": [ { "menuItemId": "<id from menu>", "quantity": <int> } ]
}
If you cannot build a cart yet (need more info), return an empty cart
and ask your question in "reply".`;
}

/**
 * Safely parse the model's JSON, tolerating stray markdown fences.
 */
function parseAiJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { reply: cleaned || "Sorry, could you rephrase that?", cart: [] };
  }
}

/**
 * Validate AI-chosen items against the real menu. This is the code-side
 * half of the grounding rule: anything the AI picked that isn't a real,
 * available item is discarded, and prices/names come from the DB — never
 * from the model.
 */
function verifyCart(aiCart, menu) {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const verified = [];
  for (const line of aiCart || []) {
    const item = byId.get(line.menuItemId);
    if (!item || !item.isAvailable) continue; // drop hallucinated/unavailable
    const quantity = Math.max(1, Math.min(20, parseInt(line.quantity, 10) || 1));
    verified.push({
      menuItemId: item.id,
      name: item.name,
      price: item.price, // authoritative price from DB
      quantity,
    });
  }
  return verified;
}

/**
 * Main entry: given a restaurant, the conversation so far, and the new
 * user message, return { reply, cart, subtotal }.
 */
async function runOrderingTurn({ restaurantId, history, userMessage }) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) throw new Error("Restaurant not found");

  const menu = await prisma.menuItem.findMany({
    where: { restaurantId, isAvailable: true },
  });
  if (menu.length === 0) {
    return { reply: "This restaurant has no available items right now.", cart: [], subtotal: 0 };
  }

  const system = buildSystemPrompt(restaurant, menu);
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const raw = await complete({ system, messages, maxTokens: 600 });
  const parsed = parseAiJson(raw);
  const cart = verifyCart(parsed.cart, menu);
  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return {
    reply: parsed.reply || "Here's what I've got for you.",
    cart,
    subtotal: Number(subtotal.toFixed(2)),
  };
}

module.exports = { runOrderingTurn, verifyCart, buildSystemPrompt };
