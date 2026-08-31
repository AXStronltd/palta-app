# Palta — Launch Checklist & Status

_Built over 14 days. This document states honestly what's production-ready,
what's stubbed for development, and exactly what you must do before going live._

---

## What you have

A working two-sided AI-native food delivery platform:

- **Customer app** (React Native / Expo): phone login, address, browse/search/filter,
  AI conversational ordering + tap-to-order (one shared cart), checkout (card/cash,
  tip, delivery/pickup), live order tracking with a map, ratings, receipts, reorder.
- **Driver app** (React Native / Expo): phone login, KYC onboarding with document
  upload, go online, receive nearest-driver dispatch offers, accept/decline, the full
  pickup→deliver→complete lifecycle, live location streaming, earnings.
- **Backend** (Node/Express/Prisma/Postgres + Socket.IO): auth, restaurants, orders
  with a guarded state machine, server-side pricing, rule-based dispatch, realtime
  events, payments abstraction, storage abstraction, AI ordering, admin API.
- **Ops console** (single-file web): admin login, stats, driver KYC approval, orders.
- **Full E2E test**: the entire flow (signup → KYC → approve → order → dispatch →
  deliver → rate) verified in one run.

---

## Production-ready as-is

- Order state machine with transition guards (illegal jumps rejected everywhere).
- **Server-side pricing** — client prices are never trusted; tampering is impossible.
- AI ordering grounded strictly in real menu data (hallucinated items dropped).
- Auth (JWT), role separation (customer/driver/admin), per-user socket rooms.
- Realtime order + location events, with location cut off after delivery.
- Rule-based dispatch (nearest online approved free driver).

---

## Stubbed for dev — MUST replace before launch

| Area | Current (dev) | Needed for production |
|---|---|---|
| **SMS OTP** | Code returned in the API response + logged | Real SMS provider (Twilio, or regional). Remove `devCode` from `/auth/request-otp`. |
| **Payments** | Stripe in **mock mode** (no key) or test mode | Real gateway + on-device card confirmation. **Depends on launch country.** |
| **Driver ID verification** | Documents captured & stored; admin approves manually | Automated KYC vendor (Onfido/Persona/regional) at the HOOK in `routes/driver.js`. |
| **File storage** | Local disk (`backend/uploads/`) | S3 / R2 / GCS — swap `services/storage.js`. |
| **Push notifications** | Expo push (works, but needs device tokens) | Verify on real devices; consider FCM/APNs directly at scale. |
| **Live map** | Static Mapbox images (Expo Go friendly) | Native `@rnmapbox/maps` for smooth markers (needs a dev build). See `LiveMap.native-notes.md`. |
| **Dispatch** | Rule-based (nearest) | Optional ML "predictive" upgrade once you have order history. Same interface. |
| **Restaurant side** | Admin/ops advances orders | A restaurant app or POS integration to accept + mark ready. |

---

## The launch-country decision (still open)

Three things are gated on **which country Palta launches in**:

1. **Payment gateway** — Stripe covers many markets; some need a local gateway
   (Paymob/PayTabs in MENA, Razorpay in India, etc.). Swap `services/payment.js`.
2. **SMS provider** — Twilio is global; local providers are often cheaper/required.
3. **Driver KYC documents** — which IDs are legally required, and which verification
   vendor operates there.

Pick the country and these three become concrete, one-file changes.

---

## Pre-launch security hardening

- [ ] Remove `devCode` from `/auth/request-otp` responses.
- [ ] Remove/disable `AUTO_APPROVE_KYC`.
- [ ] Remove or lock down `/ops/advance` (dev-only; admin does this now).
- [ ] Set a strong `JWT_SECRET` (not the dev default).
- [ ] Rate-limit auth endpoints (OTP request/verify).
- [ ] Move OTP store from in-memory to Redis (survives restarts, scales).
- [ ] Restrict the Mapbox public token by URL in your Mapbox account.
- [ ] Add HTTPS/TLS termination in front of the API.
- [ ] Lock CORS to your real app origins (currently `*`).
- [ ] Add server-side logging + error monitoring (Sentry or similar).

---

## Infrastructure to stand up

- [ ] Managed Postgres (Neon/Supabase/RDS) — run `prisma migrate deploy`.
- [ ] Redis (OTP + pending dispatch offers, which are in-memory today).
- [ ] Object storage bucket (documents).
- [ ] Host the API (Fly/Render/Railway/ECS) with the Socket.IO port open.
- [ ] Host the ops console (any static host); set its API URL.
- [ ] App store builds (EAS) for both apps — needed anyway for the native map.

---

## Recommended next features (post-MVP)

- Restaurant-facing app (accept orders, manage menu, mark ready).
- Scheduled/pre-orders; multiple saved payment methods.
- Promo codes / referrals (there's room in the schema).
- In-app chat between customer and driver.
- Predictive dispatch (ML) once you have data.
- Analytics dashboard for ops.

---

## How to run everything (recap)

```bash
# Backend
cd backend
cp .env.example .env    # add DATABASE_URL, ANTHROPIC_API_KEY, MAPBOX_TOKEN
npm install
npx prisma migrate dev --name init
npm run seed            # restaurants + an admin user (+9715550000)
npm run dev

# Customer app
cd apps/customer && npm install && npm start

# Driver app
cd apps/driver && npm install && npm start

# Ops console
open admin/index.html   # or serve the admin/ folder
```

On a physical phone, set each app's `API_URL` (in `src/lib/api.js`) to your
computer's LAN IP, not `localhost`.
