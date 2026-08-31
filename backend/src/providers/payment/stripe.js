// Stripe payment adapter — reference implementation of PaymentProvider.
// Works in MOCK mode when STRIPE_SECRET_KEY is unset (dev), real otherwise.
// Used by many countries (US, UK, EU, and more).

const { assertPaymentProvider } = require("../interfaces");

function makeStripeProvider(config = {}) {
  const secret = config.secretKey || process.env.STRIPE_SECRET_KEY || "";

  const provider = {
    name: "stripe",

    async createPaymentIntent({ amount, currency, orderId }) {
      const minor = Math.round(amount * 100); // Stripe uses minor units

      if (!secret) {
        return {
          provider: "stripe-mock",
          clientSecret: `mock_secret_${orderId}`,
          paymentIntentId: `pi_mock_${orderId}`,
          mock: true,
        };
      }

      const Stripe = require("stripe");
      const stripe = new Stripe(secret);
      const intent = await stripe.paymentIntents.create({
        amount: minor,
        currency: (currency || "usd").toLowerCase(),
        metadata: { orderId },
        automatic_payment_methods: { enabled: true },
      });
      return {
        provider: "stripe",
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        mock: false,
      };
    },

    async refund({ paymentIntentId, amount, currency, reason }) {
      if (!secret) {
        return { provider: "stripe-mock", refundId: `re_mock_${paymentIntentId}`, status: "succeeded", mock: true };
      }
      const Stripe = require("stripe");
      const stripe = new Stripe(secret);
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amount != null ? { amount: Math.round(amount * 100) } : {}),
        ...(reason ? { reason } : {}),
      });
      return { provider: "stripe", refundId: refund.id, status: refund.status };
    },
  };

  return assertPaymentProvider(provider);
}

module.exports = { makeStripeProvider };
