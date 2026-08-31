# Palta — Native App: Production & Store Roadmap

Target: **real native Palta apps** on the App Store and Google Play, backed by
a production backend with real payments and delivery operations. Not a PWA, not
a wrapper, not the demo.

This document is the engineering plan. It has three parts:
1. The architecture to build to (your vision, made concrete).
2. What's ready to build vs. what must be done first.
3. The exact store-submission path (commands, costs, assets).

---

## Part 1 — Architecture (the target)

### One platform, three app experiences, one identity

- **One backend** (Node/TypeScript + PostgreSQL + WebSockets) serving three
  React Native experiences: Customer, Merchant, Driver.
- **One Palta identity.** A user is not "a customer" or "a driver" — they hold
  a **set of roles**. Ahmed = {customer, merchant, driver}. The backend gates
  permissions and the app shows the right interface, with a role switcher.

### The unifying idea: everything is a delivery job

```
Restaurant ─┐
Shop ───────┼──→ PALTA ORDER ─→ DISPATCH ─→ DRIVER ─→ CUSTOMER
Individual ─┘
Sender ─────────→ PALTA PARCEL ─→ DISPATCH ─→ DRIVER ─→ RECIPIENT
```

Concretely, one `Job` with:
- `jobType: FOOD | SHOP | PARCEL`
- `pickup` (merchant location for orders; sender address for parcels)
- `dropoff` (customer/recipient)
- optional `merchantId` (null for parcels)
- shared `status` lifecycle and shared dispatch

Dispatch keys off **pickup**, never off "restaurant" — so parcels work the day
they're switched on, with no rewrite.

### Stack (keep what exists)
- **React Native** → iOS + Android (Expo + EAS for builds)
- **Node.js / TypeScript** → API
- **PostgreSQL** → core DB
- **WebSockets (Socket.IO)** → live order/driver updates *(built)*
- **Maps** → location, routing, navigation *(static today; needs native)*
- **Push notifications** *(built via Expo)*
- **Payment provider** → real customer payments *(abstraction built; not wired)*
- **Admin web dashboard** *(built)*

---

## Part 2 — Build order (P0 to store)

Nothing below is a demo task; these are the production gaps between the current
codebase and a submittable app.

### P0 — Must be production-ready BEFORE store submission

1. **Unified Job model** (Order → Job refactor).
   - `restaurantId` → optional `merchantId`; add `jobType`, `pickup`,
     `dropoff`. Migrate existing order flow onto it.
   - *Why first:* food, shop, and parcel all depend on it. Doing it later is a
     rewrite.

2. **Multi-role identity.**
   - `User.role` (single) → `roles String[]` (or a `UserRole` join table).
   - Auth issues a token carrying the role set; endpoints check the *active*
     role. App gets a role switcher.

3. **Real payments, one launch country, end-to-end.**
   - Customer charge → Palta commission split → merchant settlement ledger →
     driver earnings. Handle failed payments and refunds.
   - Pick the vendor for your launch country (e.g. Stripe where supported, or a
     regional gateway). The abstraction already exists; wire one real adapter.

4. **Parcel flow** on top of the Job engine.
   - Sender creates job, pickup + drop-off, package type/size, price by
     distance/size, **proof of delivery** (photo/PIN/signature).

5. **Live maps + navigation + real GPS** (native map SDK, not static images).

6. **Deploy the backend for real** — apply the Prisma migration, host on
   Fly/Render, Postgres + Redis, HTTPS. Nothing is real until this is done.

7. **Real SMS (OTP) and real KYC** for the launch country.

### P1 — Launch enhancement
- Chat/call between customer and driver.
- ETA, prep-time and vehicle type as dispatch inputs.
- Merchant scheduled hours; real inventory counts.
- Admin: payments, disputes, commissions views.

### P2 / P3
- Batching & workload optimisation, analytics, fraud/risk, promotions,
  multi-country, then super-app (rides, wallet, bill pay).

*(Full per-feature detail is in PALTA_GAP_ANALYSIS.md.)*

---

## Part 3 — Store submission path

> Do NOT submit until the P0 flows are production-ready. Apple rejects apps
> that are incomplete, don't work without setup, or can't take payment.

### 3.1 Accounts (only the owner can create these — they cost money)
- **Apple Developer Program** — **$99/year** — https://developer.apple.com/programs/
- **Google Play Console** — **$25 one-time** — https://play.google.com/console/

### 3.2 Prerequisites
- A **Mac** for iOS builds (or use EAS cloud build, which removes the Mac
  requirement for building — but you still need the Apple account).
- **Node.js 18+**, the app repo, and the backend deployed and reachable.

### 3.3 Build config (I have scaffolded this — see /mobile-build in the repo)
- `app.json` — app name, bundle IDs, icons, splash, permissions.
- `eas.json` — build profiles (development / preview / production).
- Bundle identifiers:
  - iOS: `io.paltas.customer` (and `.merchant`, `.driver` if separate apps)
  - Android: `io.paltas.customer`

### 3.4 Build the apps
```bash
npm i -g eas-cli
eas login
cd apps/customer
eas build --platform ios --profile production      # -> .ipa
eas build --platform android --profile production  # -> .aab
```

### 3.5 Submit
```bash
eas submit --platform ios       # to App Store Connect
eas submit --platform android   # to Google Play
```

### 3.6 Store listing assets you must prepare
- App icon (1024×1024), screenshots per device size.
- App name, subtitle, description, keywords.
- **Privacy policy URL** (required by both stores).
- Support URL / contact email.
- Data-safety / privacy questionnaire (both stores).
- For a delivery app: justify location/background-location use clearly, or
  Apple will reject.

### 3.7 Review
- **Apple:** ~1–3 days, strict. Common rejections: incomplete features, login
  walls with no demo account, unclear location use, payments not working.
  Provide a **reviewer demo account** for each role.
- **Google:** ~1 day, more lenient, but data-safety must be accurate.

---

## Honest status line

- **Backend architecture & core flows:** built, mock-tested. Strong foundation.
- **Customer UI design:** prototype exists at a high bar; must be ported into
  the real RN screens.
- **Everything in P0 above:** not yet production-ready.
- **Store accounts, builds, deployment, real payments:** not started — these
  are owner/developer actions on a computer, with cost.

The path is real and the foundation is real. The work between here and the
stores is the P0 list — most of which is infrastructure and three features
(jobs, multi-role, payments), not a from-scratch rebuild.
