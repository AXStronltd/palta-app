// Regional payment adapters — STUBS to fill in per launch country.
//
// Each conforms to the PaymentProvider interface so the app loads safely.
// They throw a clear "not implemented" error ONLY if actually invoked
// before you wire the real vendor. To activate one: implement the two
// methods against the vendor's API, add credentials, done.
//
//   Paymob   — Egypt, MENA
//   PayTabs  — Saudi Arabia, UAE, MENA
//   Razorpay — India
//
// Add more the same way (Checkout.com, Flutterwave, Mercado Pago, …).

const { assertPaymentProvider } = require("../interfaces");

function notImplemented(vendor, method) {
  return async () => {
    throw new Error(
      `[payment:${vendor}] ${method}() not implemented yet. ` +
      `Implement providers/payment/${vendor}.js against the ${vendor} API before launching this country.`
    );
  };
}

function makeStubProvider(vendor) {
  return assertPaymentProvider({
    name: vendor,
    createPaymentIntent: notImplemented(vendor, "createPaymentIntent"),
    refund: notImplemented(vendor, "refund"),
  });
}

module.exports = {
  makePaymobProvider: () => makeStubProvider("paymob"),
  makePayTabsProvider: () => makeStubProvider("paytabs"),
  makeRazorpayProvider: () => makeStubProvider("razorpay"),
};
