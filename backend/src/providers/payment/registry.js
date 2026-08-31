// ============================================================
// PAYMENT REGISTRY — maps each country to its payment adapter.
// This is the scale point: adding a country = ONE line here.
// The app never touches an adapter directly — it calls for(country).
// ============================================================
const { StripeCardAdapter } = require("./adapters/card.stripe");
const { MpesaKenyaAdapter } = require("./adapters/mpesa.ke");
const { EvcSomaliaAdapter } = require("./adapters/evc.so");

// country code -> factory. Config (keys) comes from env per deployment.
const MAP = {
  KE: () => new MpesaKenyaAdapter({}),      // Kenya   → M-Pesa
  SO: () => new EvcSomaliaAdapter({}),      // Somalia → EVC Plus / Zaad / eDahab
  AE: () => new StripeCardAdapter({}),      // UAE     → cards
  US: () => new StripeCardAdapter({}),      // USA     → cards
  GB: () => new StripeCardAdapter({}),      // UK      → cards
  // --- add markets here as you launch them ---
  // UG: () => new MtnMomoAdapter({}),      // Uganda  → MTN MoMo / Airtel  (add adapter file)
  // ET: () => new TelebirrAdapter({}),     // Ethiopia→ Telebirr
  // IN: () => new RazorpayAdapter({}),     // India   → UPI / cards
};

// Countries you have actually launched (have payments + drivers + legal).
// The app uses this to show full service vs. "coming soon".
const LAUNCHED = new Set(["KE"]); // expand as each market goes live

// Fallback for not-yet-integrated countries: cash-on-delivery only, so the
// app still functions (and clearly shows limited methods) instead of breaking.
const { PaymentAdapter } = require("./PaymentAdapter");
class CashOnlyAdapter extends PaymentAdapter {
  constructor(){ super({}); this.name="cash-only"; this.methods=["cash"]; }
  async collect({ orderId }){ return { ok:true, ref:`cash_${orderId}`, status:"pending" }; }
  async payout(){ return { ok:true, ref:`manual_${Date.now()}`, status:"pending" }; }
  async verify(ref){ return { ref, status:"succeeded" }; }
  async handleWebhook(){ return { handled:true }; }
}

const payments = {
  /** Get the right payment adapter for a country (defaults to cash-only if not integrated). */
  for(countryCode) {
    const make = MAP[String(countryCode || "").toUpperCase()];
    return make ? make() : new CashOnlyAdapter();
  },
  isLaunched(countryCode) { return LAUNCHED.has(String(countryCode || "").toUpperCase()); },
  supportedCountries() { return Object.keys(MAP); },
  launchedCountries() { return [...LAUNCHED]; },
  /** Methods available to show in the app for a given country. */
  methodsFor(countryCode) { return this.for(countryCode).supportedMethods(); },
};

module.exports = { payments };
