// Money formatting — locale-aware, currency-driven. One place so no screen
// ever hardcodes "$" again. Mirrors the backend's currency layer.
//
// Prices in Palta are stored in the merchant's currency; every order and
// restaurant carries a `currency` code. Pass that code here.

const CURRENCY_META = {
  KES: { symbol: "KES", locale: "en-KE" },
  AED: { symbol: "د.إ", locale: "en-AE" },
  USD: { symbol: "$", locale: "en-US" },
  GBP: { symbol: "£", locale: "en-GB" },
  INR: { symbol: "₹", locale: "en-IN" },
  EGP: { symbol: "E£", locale: "ar-EG" },
  EUR: { symbol: "€", locale: "en-IE" },
  NGN: { symbol: "₦", locale: "en-NG" },
  ZAR: { symbol: "R", locale: "en-ZA" },
  CAD: { symbol: "$", locale: "en-CA" },
  AUD: { symbol: "$", locale: "en-AU" },
};

// Kenya is the launch market, so KES is the sensible default.
const DEFAULT_CURRENCY = "KES";

// formatMoney(21.5, "USD") -> "$21.50"
export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const meta = CURRENCY_META[code];
  const n = Number(amount) || 0;
  if (meta) {
    try {
      return new Intl.NumberFormat(meta.locale, { style: "currency", currency: code }).format(n);
    } catch {
      return `${meta.symbol}${n.toFixed(2)}`;
    }
  }
  // Unknown currency: show the code so it's never silently wrong.
  return `${n.toFixed(2)} ${code}`;
}

// Just the symbol, for compact UI (e.g. "AED" chip).
export function currencySymbol(currency = DEFAULT_CURRENCY) {
  return CURRENCY_META[(currency || DEFAULT_CURRENCY).toUpperCase()]?.symbol || currency;
}

// Distance localization — km everywhere except the few miles markets (US/UK).
// Pass the user's country code; defaults to km.
const MILES_COUNTRIES = new Set(["US", "GB"]);
export function formatDistance(km, country = "KE") {
  const n = Number(km) || 0;
  if (MILES_COUNTRIES.has((country || "").toUpperCase())) {
    return `${(n * 0.621371).toFixed(1)} mi`;
  }
  return `${n.toFixed(1)} km`;
}
