// ============================================================
// Provider interfaces (ports)
// ============================================================
// These define the CONTRACT every vendor adapter must satisfy. The core
// platform only ever calls these methods — never a specific vendor's SDK.
// To add a country's provider, implement the matching interface and
// register it in that country's config. Nothing else in the app changes.
//
// This file is documentation + a runtime shape check (assertImplements),
// not an abstract class — Node has no interfaces, so we validate at load.
// ============================================================

// A PaymentProvider turns an order total into a payment the customer can
// complete, and can later refund it.
const PAYMENT_METHODS = ["createPaymentIntent", "refund"];
// createPaymentIntent({ amount, currency, orderId, customer }) ->
//   { provider, clientSecret, paymentIntentId, mock? }
// refund({ paymentIntentId, amount, currency, reason }) ->
//   { provider, refundId, status }

// An SmsProvider sends a transactional SMS (OTP codes, order updates).
const SMS_METHODS = ["send"];
// send({ to, body, senderId }) -> { provider, messageId, status }

// A KycProvider verifies a driver's identity documents.
const KYC_METHODS = ["startVerification", "getResult"];
// startVerification({ userId, documents, country }) ->
//   { provider, verificationId, status }        // status: pending|approved|rejected
// getResult({ verificationId }) ->
//   { provider, verificationId, status, reason? }

function assertImplements(kind, obj, methods) {
  const missing = methods.filter((m) => typeof obj?.[m] !== "function");
  if (missing.length) {
    throw new Error(
      `${kind} provider "${obj?.name || "unknown"}" is missing methods: ${missing.join(", ")}`
    );
  }
  return obj;
}

const assertPaymentProvider = (p) => assertImplements("Payment", p, PAYMENT_METHODS);
const assertSmsProvider = (p) => assertImplements("SMS", p, SMS_METHODS);
const assertKycProvider = (p) => assertImplements("KYC", p, KYC_METHODS);

module.exports = {
  PAYMENT_METHODS, SMS_METHODS, KYC_METHODS,
  assertPaymentProvider, assertSmsProvider, assertKycProvider,
};
