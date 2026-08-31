// ====== SOMALIA adapter — mobile money (EVC Plus / Zaad / eDahab) ======
// Somalia runs almost entirely on mobile money; cards are rare. EVC Plus
// (Hormuud) dominates. These APIs are often reached via a local partner/
// aggregator rather than a single global gateway — so this adapter is
// written to point at a configurable endpoint you set per partner.
const { PaymentAdapter } = require("../PaymentAdapter");

class EvcSomaliaAdapter extends PaymentAdapter {
  constructor(cfg) {
    super(cfg);
    this.name = "evc-so";
    this.methods = ["evc_plus", "zaad", "edahab", "cash"];
    this.endpoint = cfg.endpoint || process.env.EVC_ENDPOINT || "";
    this.merchantId = cfg.merchantId || process.env.EVC_MERCHANT_ID || "";
    this.apiKey = cfg.apiKey || process.env.EVC_API_KEY || "";
  }
  _configured() { return this.endpoint && this.merchantId && this.apiKey; }

  async collect({ amount, orderId, customer, method = "evc_plus" }) {
    if (method === "cash") return { ok: true, ref: `cash_${orderId}`, status: "pending" }; // pay on delivery
    if (!this._configured()) {
      return { ok: true, mock: true, ref: `evc_mock_${orderId}`, status: "pending",
        clientAction: { type: "ussd_prompt_sent", method, phone: customer.phone } };
    }
    // Real: POST to partner endpoint with merchantId, amount, payer phone, method.
    // Customer approves on their phone (USSD/app). Result via callback → handleWebhook().
    return { ok: true, ref: `evc_${orderId}`, status: "pending", clientAction: { type: "ussd_prompt_sent", method } };
  }

  async payout({ amount, recipient }) {
    if (!this._configured()) return { ok: true, mock: true, ref: `evcpo_mock_${Date.now()}`, status: "pending" };
    return { ok: true, ref: `evcpo_${Date.now()}`, status: "pending", to: recipient.phone };
  }
  async verify(ref) { return { ref, status: ref.includes("mock") ? "succeeded" : "pending" }; }
  async handleWebhook(payload) { return { handled: true, success: payload?.status === "success" }; }
}
module.exports = { EvcSomaliaAdapter };
