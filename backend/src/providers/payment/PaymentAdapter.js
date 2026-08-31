// ============================================================
// PaymentAdapter — the ONE interface every country plugs into.
// ============================================================
// This is the contract. Every payment method (M-Pesa, Stripe card,
// EVC Plus, MTN MoMo, UPI, ...) implements THESE methods and nothing
// else changes in the app. Adding a country = adding one adapter file
// + one registry line. That is what makes Palta scale globally.
//
// A payment app moves money in BOTH directions, so the contract covers:
//   collect() — take money from a customer (STK push / card / UPI ...)
//   payout()  — send money to a driver/merchant (M-Pesa B2C, bank ...)
//   verify()  — confirm a transaction's final status (idempotent)
//   handleWebhook() — process async provider callbacks safely
//
// SECURITY RULE (all adapters): NEVER store card numbers or mobile-money
// PINs. Hand raw payment data to the provider; keep only a token/reference.
// ============================================================

class PaymentAdapter {
  /** @param {object} cfg provider config (keys, shortcodes) from env — never hardcoded */
  constructor(cfg = {}) { this.cfg = cfg; this.name = "abstract"; this.methods = []; }

  /**
   * Collect money from a customer.
   * @returns {Promise<{ok:boolean, ref:string, status:'pending'|'succeeded'|'failed', clientAction?:object, mock?:boolean}>}
   * status is often 'pending' for async methods (STK push) — final state comes via handleWebhook/verify.
   */
  async collect({ amount, currency, method, customer, orderId, idempotencyKey }) {
    throw new Error(`${this.name}: collect() not implemented`);
  }

  /**
   * Pay out to a driver/merchant.
   * @returns {Promise<{ok:boolean, ref:string, status:string}>}
   */
  async payout({ amount, currency, recipient, reason, idempotencyKey }) {
    throw new Error(`${this.name}: payout() not implemented`);
  }

  /** Confirm a transaction's final status. MUST be idempotent (safe to call repeatedly). */
  async verify(ref) { throw new Error(`${this.name}: verify() not implemented`); }

  /** Process an async provider callback. MUST de-duplicate (providers resend callbacks). */
  async handleWebhook(payload, headers) { throw new Error(`${this.name}: handleWebhook() not implemented`); }

  /** Which payment methods this adapter offers, for the app UI. */
  supportedMethods() { return this.methods; }
}

module.exports = { PaymentAdapter };
