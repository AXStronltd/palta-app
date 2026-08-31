// KYC adapters. Default is MANUAL review (an admin approves in the ops
// console — what the platform does today). Automated vendors (Onfido,
// Persona, regional) are stubs conforming to the KycProvider interface.

const { assertKycProvider } = require("../interfaces");

// Manual review — no external vendor. startVerification just marks the
// driver pending; a human decides in the admin console. getResult reads
// back whatever the admin set (handled by the driver/admin routes).
function makeManualProvider() {
  return assertKycProvider({
    name: "manual",
    async startVerification({ userId }) {
      return { provider: "manual", verificationId: `manual_${userId}`, status: "pending" };
    },
    async getResult({ verificationId }) {
      // Manual results live in the DB (driverProfile.kycStatus), so this
      // adapter is a passthrough; callers read the profile directly.
      return { provider: "manual", verificationId, status: "pending" };
    },
  });
}

function notImplemented(vendor, method) {
  return async () => {
    throw new Error(`[kyc:${vendor}] ${method}() not implemented. Implement providers/kyc/${vendor} before automating KYC.`);
  };
}
const makeStub = (vendor) => assertKycProvider({
  name: vendor,
  startVerification: notImplemented(vendor, "startVerification"),
  getResult: notImplemented(vendor, "getResult"),
});

module.exports = {
  makeManualProvider,
  makeOnfidoProvider: () => makeStub("onfido"),     // global
  makePersonaProvider: () => makeStub("persona"),   // global
};
