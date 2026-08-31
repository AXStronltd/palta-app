# Palta — Alignment Cards (Prototype → Real App → Live Backend)

The HTML prototype is the **approved blueprint**. This document is the ordered
list of "cards" (work items) that bring the real React Native app and the
backend up to match it, and get the whole thing deployable for real users.

Work top to bottom. Each card is self-contained and testable.
Status: ⬜ not started · 🟡 in progress · ✅ done

---

## PHASE 1 — Make the backend real & deployable
*(Nothing else matters until the backend runs against a real database in the cloud.)*

- ✅ **Card 1 — Database migrations.** DONE — initial migration written (10 tables, 8 enums, 10 FKs), runs on deploy via prisma migrate deploy.
- ~~Card 1 (original)~~ The Prisma schema has 10 models but ZERO
  migrations. Generate the initial migration so a fresh deploy can build the DB.
  `cd backend && npx prisma migrate dev --name init`
- ⬜ **Card 2 — Environment config.** Confirm `.env.example` lists every var the
  code reads (DB, Redis, JWT, Anthropic, M-Pesa, Africa's Talking). No real
  secrets in git.
- ⬜ **Card 3 — Deploy backend.** Use `render.yaml` (already written) → Render
  Blueprint → live URL + Postgres + Redis. Run migrations on deploy.
- ⬜ **Card 4 — Seed data.** Run the seed against the live DB so there are demo
  restaurants/products to show.

## PHASE 2 — Connect the real app to the real backend
*(The RN app currently points at `http://localhost:4000` — unreachable by users.)*

- ✅ **Card 5 — API base URL from env.** DONE — both apps resolve API_URL from EXPO_PUBLIC_API_URL / app.json extra.apiUrl, localhost only as dev fallback.
- ~~Card 5 (original)~~ Replace the hardcoded localhost in
  `apps/customer/src/lib/api.js` (and driver app) with an env-driven URL that
  points at the deployed backend.
- ✅ **Card 6 — Auth end-to-end.** DONE (already built) — phone→OTP→JWT→session restore via /auth/me, mock SMS in dev, rate-limited. Verified. Wire real phone login → OTP (SMS) → JWT →
  authenticated requests. Test against the live backend.
- ⬜ **Card 7 — Verify existing flows app→backend→DB.** Restaurants list, menu,
  checkout, order, tracking — confirm each actually reads/writes the live DB.

## PHASE 3 — Port prototype features into the real RN app
*(These exist ONLY in the HTML prototype today. Build them for real.)*

- ✅ **Card 8 — Grocery Store catalog.** DONE — StoreScreen.js built in RN app: aisle chips, live search, quantity +/- controls, sold-out greyed, cart bar, uses shared cartStore + money. Registered in nav. (browse aisles, search, quantities).
  Backend: needs a `products`/`catalog` concept beyond restaurant `MenuItem`.
- ✅ **Card 9 — Cart (partial).** DONE for store — StoreScreen uses cartStore.setQuantity for +/- and a live cart bar. Shared with food checkout. RN has a `cartStore.js` —
  extend it for the store/grocery model.
- ✅ **Card 10 — Merchant: add products (manual).** DONE — restaurant web dashboard has working add/edit/toggle-stock/delete wired to real backend (/restaurant/menu POST/PATCH/DELETE). Also added order:status live-refresh so the board updates when driver advances an order. Barcode-scan input method deferred (needs camera + product-DB integration).
- ⬜ **Card 11 — Merchant: menu file upload → AI extract → publish.** Wire to the
  backend `ai` route (document parsing via Anthropic).
- ✅ **Card 12 — In-stock state.** DONE — merchant toggles isAvailable (Mark out/in); customer StoreScreen greys sold-out items. (Draft/publish is a prototype nicety; backend items are live when created.) for catalog items, surfaced
  to customers (sold-out greyed).
- ✅ **Card 13 — Connected order lifecycle.** DONE — backend transition() now emits order:status to customer+driver+merchant on every state change; RN OrderTracking + ParcelTracking subscribe live; backend states and RN stages perfectly aligned (8 states).
- ~~Card 13 (original)~~ (Customer→Shop→Driver→Customer) over
  real Socket.IO events (backend already has `realtime.js`).
- ✅ **Card 14 — Driver alarm.** DONE — DeliveryRequestModal now fires repeating vibration (Android pattern + iOS pulse) + looping alarm sound (expo-av, graceful if asset missing), plus the existing countdown + auto-decline. Accept/Decline stop the alarm. (sound + vibration + countdown +
  auto-reassign) triggered by a real push/socket event.
- ✅ **Card 15 — Driver navigation.** DONE — ActiveDeliveryScreen has a large (340px) live map, a status/turn banner (TO PICKUP / ON DELIVERY), step tracker, and Open-in-Maps for real native turn-by-turn. Driver home now also listens for order:status. (driver turn-by-turn + rider live map)
  with real Mapbox.
- ✅ **Card 16 — Country localization.** DONE — money.js now defaults to KES (launch market), covers KES/NGN/ZAR/+ more, and has formatDistance (km vs mi per country). Backend countries.js already has full per-country config; screens pass currency into formatMoney. end-to-end (currency/distance/dial from
  the backend `config` per user's country). Foundation already exists in
  `money.js` + `config` route.
- ✅ **Card 17 — Profile screen.** DONE — built ProfileScreen.js: real user info from /auth/me, live address count from /addresses, menu sections (payment, addresses, orders, promos, help, settings), working sign-out (clearToken). Registered in nav. No dead alerts. (payment methods, addresses, favourites,
  promos, help, settings) as real screens backed by the API.

## PHASE 4 — Production hardening (non-negotiable before public)

- ⬜ **Card 18 — Real M-Pesa** (Daraja STK push, callbacks, reconciliation).
- ⬜ **Card 19 — Real SMS auth** (Africa's Talking) for OTP.
- ⬜ **Card 20 — Real KYC + encryption at rest** per country law (Kenya DPA).
- ⬜ **Card 21 — Security pass** (helmet, HTTPS, rate limits, JWT rotation,
  input validation) — partly done, audit before launch.
- ⬜ **Card 22 — Native builds** (`eas build`) + store submission (Apple $99/yr,
  Google $25).

## PHASE 5 — The real launch problem (not code)

- ⬜ **Card 23 — Driver supply.** Recruit enough drivers in ONE launch zone
  (e.g. Westlands/Kilimani) so pickup is <5 min. This is the make-or-break.
- ⬜ **Card 24 — Merchant supply.** Onboard a cluster of shops/restaurants in
  that same zone.

---

## How we're working through these
Starting with **Card 1** and going in order. Phase 1 & 2 are the true blockers —
without a live backend the app can't serve anyone. Phase 3 is the bulk of the
build. Phases 4–5 are launch gates.

I'll do what's doable from here (migrations, config, code changes, wiring) and
clearly flag what needs YOU (deploy button clicks, real API keys, recruiting
drivers) — because those genuinely require your accounts and real-world action.
