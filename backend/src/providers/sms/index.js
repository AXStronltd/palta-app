// SMS adapters. Twilio is the global reference (mock in dev). Regional
// stubs conform to the SmsProvider interface, ready to implement.

const { assertSmsProvider } = require("../interfaces");

function makeTwilioProvider(config = {}) {
  const sid = config.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const token = config.authToken || process.env.TWILIO_AUTH_TOKEN || "";
  const from = config.from || process.env.TWILIO_FROM || "";

  return assertSmsProvider({
    name: "twilio",
    async send({ to, body, senderId }) {
      if (!sid || !token) {
        // MOCK mode — dev. Logs instead of sending; the code is still
        // returned to the client by the auth route in dev anyway.
        console.log(`[sms:twilio-mock] -> ${to}: ${body}`);
        return { provider: "twilio-mock", messageId: `sm_mock_${Date.now()}`, status: "queued", mock: true };
      }
      const twilio = require("twilio")(sid, token);
      const msg = await twilio.messages.create({ to, from: senderId || from, body });
      return { provider: "twilio", messageId: msg.sid, status: msg.status };
    },
  });
}

function notImplemented(vendor) {
  return async () => {
    throw new Error(`[sms:${vendor}] send() not implemented. Implement providers/sms/${vendor} before launch.`);
  };
}
const makeStub = (vendor) => assertSmsProvider({ name: vendor, send: notImplemented(vendor) });

module.exports = {
  makeTwilioProvider,
  // Regional examples — fill per country:
  makeUnifonicProvider: () => makeStub("unifonic"),   // MENA
  makeMsg91Provider: () => makeStub("msg91"),         // India
};
