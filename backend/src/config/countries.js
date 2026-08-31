// ============================================================
// Country registry — the core of Palta's global-reach design.
// ============================================================
// Each country is a config object declaring:
//   - currency, locale, timezone, distance unit
//   - which payment / sms / kyc providers it uses
//   - phone dial code + basic phone validation
//   - regulatory flags (e.g. whether automated KYC is required)
//
// Adding a country = add one entry here + ensure its providers exist.
// The core platform reads these values; it never hardcodes a country.
// ============================================================

const { makeStripeProvider } = require("../providers/payment/stripe");
const { makePaymobProvider, makePayTabsProvider, makeRazorpayProvider } = require("../providers/payment/regional");
const { makeTwilioProvider, makeUnifonicProvider, makeMsg91Provider } = require("../providers/sms");
const { makeManualProvider, makeOnfidoProvider } = require("../providers/kyc");

// Provider factories are lazy: only built when a country is resolved, so
// an unimplemented regional stub never runs unless that country is active.
const COUNTRIES = {
  AE: {
    code: "AE", name: "United Arab Emirates",
    currency: "AED", currencySymbol: "د.إ", locale: "en-AE", timezone: "Asia/Dubai",
    distanceUnit: "km", dialCode: "+971", phoneRegex: /^\+971\d{8,9}$/,
    requiresAutomatedKyc: true,
    providers: {
      payment: () => makePayTabsProvider(),   // regional; falls back to Stripe if you prefer
      sms: () => makeTwilioProvider(),
      kyc: () => makeManualProvider(),         // swap to makeOnfidoProvider() when automating
    },
  },
  US: {
    code: "US", name: "United States",
    currency: "USD", currencySymbol: "$", locale: "en-US", timezone: "America/New_York",
    distanceUnit: "mi", dialCode: "+1", phoneRegex: /^\+1\d{10}$/,
    requiresAutomatedKyc: false,
    providers: {
      payment: () => makeStripeProvider(),
      sms: () => makeTwilioProvider(),
      kyc: () => makeManualProvider(),
    },
  },
  GB: {
    code: "GB", name: "United Kingdom",
    currency: "GBP", currencySymbol: "£", locale: "en-GB", timezone: "Europe/London",
    distanceUnit: "mi", dialCode: "+44", phoneRegex: /^\+44\d{9,10}$/,
    requiresAutomatedKyc: true,
    providers: {
      payment: () => makeStripeProvider(),
      sms: () => makeTwilioProvider(),
      kyc: () => makeOnfidoProvider(),
    },
  },
  IN: {
    code: "IN", name: "India",
    currency: "INR", currencySymbol: "₹", locale: "en-IN", timezone: "Asia/Kolkata",
    distanceUnit: "km", dialCode: "+91", phoneRegex: /^\+91\d{10}$/,
    requiresAutomatedKyc: true,
    providers: {
      payment: () => makeRazorpayProvider(),
      sms: () => makeMsg91Provider(),
      kyc: () => makeManualProvider(),
    },
  },
  EG: {
    code: "EG", name: "Egypt",
    currency: "EGP", currencySymbol: "E£", locale: "ar-EG", timezone: "Africa/Cairo",
    distanceUnit: "km", dialCode: "+20", phoneRegex: /^\+20\d{9,10}$/,
    requiresAutomatedKyc: true,
    providers: {
      payment: () => makePaymobProvider(),
      sms: () => makeUnifonicProvider(),
      kyc: () => makeManualProvider(),
    },
  },
  KE: {
    code: "KE", name: "Kenya",
    currency: "KES", currencySymbol: "KES", locale: "en-KE", timezone: "Africa/Nairobi",
    distanceUnit: "km", dialCode: "+254", phoneRegex: /^\+254\d{9}$/,
    requiresAutomatedKyc: false,
    // Launch market. Real production wires M-Pesa (Daraja) for payment and a
    // local SMS gateway (e.g. Africa's Talking); using existing providers as
    // placeholders until those integrations land.
    providers: {
      payment: () => makeStripeProvider(),   // TODO: swap to M-Pesa Daraja adapter
      sms: () => makeTwilioProvider(),        // TODO: swap to Africa's Talking
      kyc: () => makeManualProvider(),
    },
  },
};

// The countries Palta is live in. Controlled by env so you can enable a
// country without a code change once its providers are ready.
const ENABLED = (process.env.ENABLED_COUNTRIES || "AE,US,GB")
  .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

const DEFAULT_COUNTRY = (process.env.DEFAULT_COUNTRY || "AE").toUpperCase();

function isSupported(code) {
  return !!COUNTRIES[code?.toUpperCase()];
}
function isEnabled(code) {
  return ENABLED.includes(code?.toUpperCase());
}
function getCountry(code) {
  const c = COUNTRIES[code?.toUpperCase()];
  if (!c) throw new Error(`Unsupported country: ${code}`);
  return c;
}
function listEnabledCountries() {
  return ENABLED.filter(isSupported).map((code) => {
    const { code: c, name, currency, currencySymbol, dialCode, distanceUnit } = COUNTRIES[code];
    return { code: c, name, currency, currencySymbol, dialCode, distanceUnit };
  });
}

module.exports = {
  COUNTRIES, ENABLED, DEFAULT_COUNTRY,
  isSupported, isEnabled, getCountry, listEnabledCountries,
};
