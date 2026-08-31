// ============================================================
// Palta AI layer — LLM client
// ============================================================
//
// CORE GROUNDING RULE (Day 1 — do not violate anywhere in ai/):
//
//   The AI must ONLY ever reference real, in-stock menu items
//   pulled live from the MenuItem table. It never invents dishes,
//   prices, or restaurants. Every suggestion is grounded in data
//   passed into the prompt as context.
//
// This is what keeps conversational ordering trustworthy instead
// of hallucinating food that doesn't exist. Build every ordering
// feature (Day 2+) on top of this rule.
// ============================================================

const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

/**
 * Low-level single-shot completion. Used by /ai/ping today;
 * ordering + support build on this later.
 */
async function complete({ system, messages, maxTokens = 1024 }) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });

  // Concatenate all text blocks from the response.
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

module.exports = { anthropic, complete, MODEL };
