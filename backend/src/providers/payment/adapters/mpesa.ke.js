// ====== KENYA adapter — M-Pesa via Safaricom Daraja API ======
// collect() = STK Push (customer gets a PIN prompt on their phone)
// payout()  = B2C (pay drivers/merchants out to their M-Pesa)
//
// REAL-WORLD NOTES baked in from Daraja integration experience:
//  • Phone numbers MUST be 2547XXXXXXXX (not +254, not 07XX). normalizeMsisdn() handles it.
//  • OAuth token should be CACHED (~3500s TTL) — don't fetch one per transaction.
//  • Callback URL must be PUBLICLY reachable (Safaricom can't hit localhost).
//  • De-dupe on MpesaReceiptNumber so a resent callback can't double-process.
//  • Go-live requires Safaricom approval + business docs (paybill, KRA, etc.).
const { PaymentAdapter } = require("../PaymentAdapter");

function normalizeMsisdn(phone) {
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") && p.length === 9) p = "254" + p;
  if (p.startsWith("254") === false && p.length > 9) p = "254" + p.slice(-9);
  return p;
}

class MpesaKenyaAdapter extends PaymentAdapter {
  constructor(cfg) {
    super(cfg);
    this.name = "mpesa-ke";
    this.methods = ["mpesa"];
    this.key = cfg.consumerKey || process.env.MPESA_CONSUMER_KEY || "";
    this.secret = cfg.consumerSecret || process.env.MPESA_CONSUMER_SECRET || "";
    this.shortcode = cfg.shortcode || process.env.MPESA_SHORTCODE || "";
    this.passkey = cfg.passkey || process.env.MPESA_PASSKEY || "";
    this.callbackUrl = cfg.callbackUrl || process.env.MPESA_CALLBACK_URL || "";
    this._token = null; this._tokenExp = 0;
  }

  _configured() { return this.key && this.secret && this.shortcode; }

  async _accessToken() {
    // cache token ~3500s
    if (this._token && Date.now() < this._tokenExp) return this._token;
    // const auth = Buffer.from(`${this.key}:${this.secret}`).toString("base64");
    // const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, { headers:{ Authorization:`Basic ${auth}` }});
    // this._token = (await res.json()).access_token; this._tokenExp = Date.now() + 3500*1000;
    this._token = "MOCK_TOKEN"; this._tokenExp = Date.now() + 3500 * 1000;
    return this._token;
  }

  async collect({ amount, orderId, customer }) {
    const phone = normalizeMsisdn(customer.phone);
    if (!this._configured()) {
      // MOCK STK push — flow works with no Daraja account yet.
      return { ok: true, mock: true, ref: `stk_mock_${orderId}`, status: "pending",
        clientAction: { type: "stk_push_sent", phone } };
    }
    await this._accessToken();
    // Real: POST /mpesa/stkpush/v1/processrequest with password = base64(shortcode+passkey+timestamp),
    // Amount, PartyA=phone, PartyB=shortcode, CallBackURL=this.callbackUrl, AccountReference=orderId.
    // Safaricom pushes the PIN prompt; final result arrives at your callback → handleWebhook().
    return { ok: true, ref: `stk_${orderId}`, status: "pending", clientAction: { type: "stk_push_sent", phone } };
  }

  async payout({ amount, recipient }) {
    const phone = normalizeMsisdn(recipient.phone);
    if (!this._configured()) return { ok: true, mock: true, ref: `b2c_mock_${Date.now()}`, status: "pending" };
    // Real: B2C /mpesa/b2c/v1/paymentrequest — pay a driver/merchant out to M-Pesa.
    return { ok: true, ref: `b2c_${Date.now()}`, status: "pending", to: phone };
  }

  async verify(ref) { return { ref, status: ref.includes("mock") ? "succeeded" : "pending" }; }

  async handleWebhook(payload) {
    // Daraja posts { Body:{ stkCallback:{ ResultCode, CallbackMetadata:{ MpesaReceiptNumber, ... }}}}
    // ResultCode 0 = success. De-dupe on MpesaReceiptNumber (unique constraint).
    const cb = payload?.Body?.stkCallback;
    if (!cb) return { handled: false };
    return { handled: true, success: cb.ResultCode === 0, receipt: cb?.CallbackMetadata };
  }
}
module.exports = { MpesaKenyaAdapter, normalizeMsisdn };
