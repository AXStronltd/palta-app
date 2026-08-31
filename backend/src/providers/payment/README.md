# Palta Payments — Global, Scalable Architecture

One interface. Every country plugs in. Adding a market = one adapter + one registry line.

## How it fits together
```
app / checkout
      │  payments.for(countryCode).collect({...})
      ▼
registry.js  ──picks──►  adapter (per country)
                          ├─ card.stripe.js   → AE, US, GB, EU  (cards, Apple/Google Pay)
                          ├─ mpesa.ke.js       → KE  (STK Push + B2C payout)
                          ├─ evc.so.js         → SO  (EVC Plus / Zaad / eDahab)
                          └─ CashOnlyAdapter    → fallback for not-yet-integrated countries
```

Every adapter implements the same `PaymentAdapter` contract:
- `collect()` — take money from a customer
- `payout()`  — pay a driver/merchant
- `verify()`  — confirm final status (idempotent)
- `handleWebhook()` — process async callbacks (de-duplicated)
- `supportedMethods()` — what the app shows

## To launch a new country
1. Add an adapter file in `adapters/` (copy the closest one).
2. Add one line to `registry.js` MAP.
3. Add the country to `LAUNCHED` once payments + drivers + legal are ready.
4. Set that provider's credentials as env vars (never in code).

## Security (all adapters)
- **Never** store card numbers or mobile-money PINs — only a token/reference.
- All keys come from **environment variables**, never hardcoded.
- Webhooks must **verify signatures** and **de-duplicate** (providers resend).
- `collect()` returns `status:"pending"` for async methods; the final state
  arrives via the provider callback → `handleWebhook()`.

## Mock mode
Every adapter runs in MOCK mode when its credentials are unset, so the full
checkout + payout flow works in development before any vendor account exists.
Real calls activate automatically once env vars are present.

## Per-country integration notes
| Country | Method | Provider | Notes |
|---|---|---|---|
| 🇰🇪 KE | M-Pesa | Safaricom Daraja | STK Push + B2C. ~5 wks, needs paybill/KRA + Safaricom go-live approval. Phone must be 2547XXXXXXXX. Callback URL must be public. |
| 🇸🇴 SO | EVC Plus/Zaad/eDahab | local partner/aggregator | Mobile money dominates; cards rare. Endpoint configurable per partner. |
| 🇦🇪🇺🇸🇬🇧 | Cards | Stripe | One account covers many card countries + Apple/Google Pay. Easiest — do first. |
| 🇺🇬 UG | MTN MoMo/Airtel | (add adapter) | MTN has a public dev API. |
| 🇪🇹 ET | Telebirr | (add adapter) | State telecom mobile money. |
| 🇮🇳 IN | UPI/cards | Razorpay/PhonePe | UPI dominant. |

**Tip:** start via an aggregator (Paystack/Flutterwave/Stripe) to cover several
methods fast; move to direct integrations as volume grows.
