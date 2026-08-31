// ============================================================
// Palta - Conversational Ordering Engine
// ============================================================
//
// Turns natural language into a verified cart of REAL menu items.
//
// IMPORTANT:
// - The AI can only select items that exist in the live database menu.
// - The AI cannot invent dishes, prices, or restaurants.
// - Every selected item is verified against the database.
// - Names and prices always come from the database.
// ============================================================

const { complete } = require("../client");
const { prisma } = require("../../prisma");

/**
 * Build the AI system prompt using the restaurant's REAL menu.
 */
function buildSystemPrompt(restaurant, menu) {
  const menuLines = menu
    .map(
      (m) =>
        `- id:${m.id} | ${m.name} | $${Number(m.price).toFixed(2)} | ${m.category}` +
        (m.description ? ` | ${m.description}` : "")
    )
    .join("\n");

  return `You are Palta's ordering assistant for "${restaurant.name}".

Your job is to understand what the customer wants and select matching
items FROM THE MENU BELOW ONLY.

NEVER invent:
- dishes
- menu items
- prices
- restaurants
- menu item IDs

MENU:
${menuLines}

RULES:
- Only choose items whose exact ID appears in the menu above.
- Respect the customer's budget.
- Respect dietary requirements.
- Respect exclusions such as "no seafood", "no meat", etc.
- Respect quantities.
- Never create an item that is not in the menu.
- Never change a menu item's price.
- If nothing matches, explain briefly and suggest a real item from the menu.
- If you need more information, ask one short question.
- Keep replies short and friendly.

Return JSON ONLY.
Do not use markdown.
Do not use code fences.

Exact response format:
{
  "reply": "one short friendly sentence",
  "cart": [
    {
      "menuItemId": "EXACT_MENU_ITEM_ID",
      "quantity": 1
    }
  ]
}

If you cannot build a cart yet, return:
{
  "reply": "your short question",
  "cart": []
}`;
}

/**
 * Safely parse AI JSON.
 *
 * Some models occasionally return markdown code fences,
 * so we remove them before parsing.
 */
function parseAiJson(text) {
  if (!text || typeof text !== "string") {
    return {
      reply: "Sorry, could you rephrase that?",
      cart: [],
    };
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    return {
      reply:
        typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : "Here's what I've got for you.",
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
    };
  } catch {
    return {
      reply: cleaned || "Sorry, could you rephrase that?",
      cart: [],
    };
  }
}

/**
 * Verify the AI cart against the REAL database menu.
 *
 * The AI is never trusted for:
 * - item name
 * - price
 * - availability
 *
 * Those values always come from the database.
 */
function verifyCart(aiCart, menu) {
  const byId = new Map(menu.map((item) => [String(item.id), item]));

  const verified = [];

  for (const line of Array.isArray(aiCart) ? aiCart : []) {
    if (!line || typeof line !== "object") {
      continue;
    }

    const menuItemId = String(line.menuItemId || "").trim();

    if (!menuItemId) {
      continue;
    }

    const item = byId.get(menuItemId);

    // Ignore hallucinated or unavailable items.
    if (!item || !item.isAvailable) {
      continue;
    }

    let quantity = parseInt(line.quantity, 10);

    if (!Number.isFinite(quantity)) {
      quantity = 1;
    }

    // Keep quantities safe.
    quantity = Math.max(1, Math.min(20, quantity));

    verified.push({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      quantity,
    });
  }

  return verified;
}

/**
 * Run one conversational ordering turn.
 *
 * Input:
 * {
 *   restaurantId,
 *   history,
 *   userMessage
 * }
 *
 * Returns:
 * {
 *   reply,
 *   cart,
 *   subtotal
 * }
 */
async function runOrderingTurn({
  restaurantId,
  history = [],
  userMessage,
}) {
  if (!restaurantId) {
    throw new Error("Restaurant ID is required");
  }

  if (!userMessage || typeof userMessage !== "string") {
    throw new Error("User message is required");
  }

  // ----------------------------------------------------------
  // 1. Load restaurant
  // ----------------------------------------------------------

  const restaurant = await prisma.restaurant.findUnique({
    where: {
      id: restaurantId,
    },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // ----------------------------------------------------------
  // 2. Load REAL available menu items
  // ----------------------------------------------------------

  const menu = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      isAvailable: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  if (menu.length === 0) {
    return {
      reply: "This restaurant has no available items right now.",
      cart: [],
      subtotal: 0,
    };
  }

  // ----------------------------------------------------------
  // 3. Build grounded AI prompt
  // ----------------------------------------------------------

  const system = buildSystemPrompt(restaurant, menu);

  // ----------------------------------------------------------
  // 4. Clean conversation history
  // ----------------------------------------------------------

  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (message) =>
            message &&
            (message.role === "user" ||
              message.role === "assistant" ||
              message.role === "system") &&
            typeof message.content === "string"
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }))
    : [];

  const messages = [
    ...safeHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];

  // ----------------------------------------------------------
  // 5. Ask AI
  // ----------------------------------------------------------

  const raw = await complete({
    system,
    messages,
    maxTokens: 600,
  });

  // ----------------------------------------------------------
  // 6. Parse AI response
  // ----------------------------------------------------------

  const parsed = parseAiJson(raw);

  // ----------------------------------------------------------
  // 7. Verify AI cart against database
  // ----------------------------------------------------------

  const cart = verifyCart(parsed.cart, menu);

  // ----------------------------------------------------------
  // 8. Calculate subtotal using DATABASE prices
  // ----------------------------------------------------------

  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.price) * Number(item.quantity);
  }, 0);

  // ----------------------------------------------------------
  // 9. Return verified result
  // ----------------------------------------------------------

  return {
    reply:
      parsed.reply ||
      "Here's what I've got for you.",
    cart,
    subtotal: Number(subtotal.toFixed(2)),
  };
}

module.exports = {
  runOrderingTurn,
  verifyCart,
  buildSystemPrompt,
  parseAiJson,
};
