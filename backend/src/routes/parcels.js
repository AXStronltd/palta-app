// Parcel delivery — the "send a package" flow.
//
// A parcel is just a Job with jobType=PARCEL and no merchant. It carries its
// own pickup + drop-off and goes straight into the SAME dispatch engine used
// for food and shop orders. This is the PALTA PARCEL -> DISPATCH -> DRIVER ->
// RECIPIENT path from the platform architecture.

const express = require("express");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { offerToNext } = require("../services/dispatch");
const { distanceKm } = require("../services/dispatch");
const { getCountry } = require("../config/countries");

const router = express.Router();
router.use(requireAuth);

// Parcel pricing: base + per-km, scaled by size. Kept simple and transparent;
// real pricing would come from the country/pricing config.
const SIZE_MULT = { SMALL: 1, MEDIUM: 1.4, LARGE: 1.9 };
function priceParcel({ km, size, country }) {
  const c = (() => { try { return getCountry(country); } catch { return null; } })();
  const base = 5;          // base fee
  const perKm = 1.5;       // per-km
  const mult = SIZE_MULT[size] || 1;
  const fee = (base + perKm * km) * mult;
  return Math.round(fee * 100) / 100;
}

// POST /parcels — create a parcel delivery job
router.post("/", async (req, res, next) => {
  try {
    const {
      pickupLat, pickupLng, pickupAddress, pickupContact,
      dropoffLat, dropoffLng, deliveryAddress, dropoffContact,
      size = "SMALL", note,
    } = req.body || {};

    if (pickupLat == null || pickupLng == null || !pickupAddress) {
      return res.status(400).json({ error: "pickup location is required" });
    }
    if (dropoffLat == null || dropoffLng == null || !deliveryAddress) {
      return res.status(400).json({ error: "drop-off location is required" });
    }
    if (!SIZE_MULT[size]) {
      return res.status(400).json({ error: "size must be SMALL, MEDIUM or LARGE" });
    }

    const km = Math.round(distanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng) * 10) / 10;
    const country = req.user.country || "AE";
    let currency = "AED";
    try { currency = getCountry(country).currency; } catch { /* default */ }
    const fee = priceParcel({ km, size, country });

    // Simple 4-digit delivery PIN as proof of delivery.
    const proofPin = String(Math.floor(1000 + Math.random() * 9000));

    const job = await prisma.order.create({
      data: {
        jobType: "PARCEL",
        customerId: req.user.userId,
        restaurantId: null,
        currency, country,
        status: "READY", // parcels have no prep step — ready to dispatch now
        items: [{ name: `Parcel (${size})`, quantity: 1, price: fee }],
        subtotal: fee,
        deliveryFee: 0,
        tip: 0,
        total: fee,
        deliveryAddress,
        pickupLat, pickupLng, pickupAddress, pickupContact,
        dropoffLat, dropoffLng, dropoffContact,
        parcelSize: size,
        parcelNote: note || null,
        proofPin,
      },
    });

    // Straight into the shared dispatch engine.
    const offered = await offerToNext(job.id).catch(() => null);

    res.status(201).json({
      parcel: {
        id: job.id,
        jobType: job.jobType,
        km,
        price: fee,
        currency,
        size,
        proofPin, // shown to sender; recipient/driver confirm with it
        status: job.status,
        driverOffered: offered ? true : false,
      },
    });
  } catch (e) { next(e); }
});

// GET /parcels/quote — price preview before creating
router.get("/quote", async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, size = "SMALL" } = req.query;
  if ([pickupLat, pickupLng, dropoffLat, dropoffLng].some((x) => x == null)) {
    return res.status(400).json({ error: "pickup and drop-off coordinates required" });
  }
  const km = Math.round(distanceKm(+pickupLat, +pickupLng, +dropoffLat, +dropoffLng) * 10) / 10;
  const country = req.user.country || "AE";
  let currency = "AED";
  try { currency = getCountry(country).currency; } catch { /* default */ }
  res.json({ km, size, price: priceParcel({ km, size, country }), currency });
});

module.exports = router;
