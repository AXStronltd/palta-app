// Country resolver — the single place the app asks "for country X, which
// payment / sms / kyc provider do I use?" Providers are built once per
// country and cached, so regional stubs are never even constructed unless
// that country is actually resolved.

const { getCountry, DEFAULT_COUNTRY, isEnabled } = require("./countries");

const cache = new Map(); // code -> { payment, sms, kyc }

function providersFor(code) {
  const cc = (code || DEFAULT_COUNTRY).toUpperCase();
  if (cache.has(cc)) return cache.get(cc);

  const country = getCountry(cc);
  const built = {
    country,
    payment: country.providers.payment(),
    sms: country.providers.sms(),
    kyc: country.providers.kyc(),
  };
  cache.set(cc, built);
  return built;
}

function paymentFor(code) { return providersFor(code).payment; }
function smsFor(code) { return providersFor(code).sms; }
function kycFor(code) { return providersFor(code).kyc; }

// Format a money amount in a country's currency + locale.
function formatMoney(amount, code) {
  const country = getCountry((code || DEFAULT_COUNTRY).toUpperCase());
  try {
    return new Intl.NumberFormat(country.locale, {
      style: "currency", currency: country.currency,
    }).format(amount);
  } catch {
    return `${country.currencySymbol}${amount.toFixed(2)}`;
  }
}

// Validate a phone number against a country's pattern.
function isValidPhone(phone, code) {
  const country = getCountry((code || DEFAULT_COUNTRY).toUpperCase());
  return country.phoneRegex.test(phone);
}

module.exports = {
  providersFor, paymentFor, smsFor, kycFor,
  formatMoney, isValidPhone,
  isEnabled,
};
