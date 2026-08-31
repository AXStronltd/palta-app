// Money formatting — locale-aware, currency-driven. One place so no screen
// ever hardcodes "$" again. Mirrors the backend's currency layer.
//
// Prices in Palta are stored in the merchant's currency; every order and
// restaurant carries a `currency` code. Pass that code here.

const CURRENCY_META = {
  AED: { symbol: "د.إ", locale: "en-AE" },
  USD: { symbol: "$", locale: "en-US" },
  GBP: { symbol: "£", locale: "en-GB" },
  INR: { symbol: "₹", locale: "en-IN" },
  EGP: { symbol: "E£", locale: "ar-EG" },
  EUR: { symbol: "€", locale: "en-IE" },
};

const DEFAULT_CURRENCY = "AED";

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
