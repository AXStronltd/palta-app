// Driver routes — KYC onboarding.
//   GET  /driver/me                 current driver profile + docs + status
//   PATCH /driver/profile           save personal + vehicle details
//   POST /driver/documents          upload a document (base64) 
//   POST /driver/submit             submit KYC for review (PENDING)
//
// Documents are uploaded as base64 JSON to avoid multipart setup in dev.
// Real apps stream multipart; this keeps the pipeline simple and testable.

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { storage } = require("../services/storage");
const { acceptOffer, declineOffer } = require("../services/dispatch");
const { transition } = require("../services/order");

const router = express.Router();
router.use(requireAuth);

// Ensure the caller is a driver and has a profile row (create on first touch).
async function getOrCreateProfile(userId) {
  let profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { documents: true },
  });
  if (!profile) {
    profile = await prisma.driverProfile.create({
      data: { userId },
      include: { documents: true },
    });
  }
  return profile;
}

// GET /driver/me
router.get("/me", async (req, res) => {
  const profile = await getOrCreateProfile(req.user.userId);
  res.json({ profile });
});

const profileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  dateOfBirth: z.string().max(20).optional(),
  vehicleType: z.string().max(40).optional(),
  vehicleMake: z.string().max(40).optional(),
  vehicleModel: z.string().max(40).optional(),
  vehicleColor: z.string().max(30).optional(),
  licensePlate: z.string().max(20).optional(),
});

// PATCH /driver/profile
router.patch("/profile", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid profile" });

  await getOrCreateProfile(req.user.userId);
  const profile = await prisma.driverProfile.update({
    where: { userId: req.user.userId },
    data: parsed.data,
    include: { documents: true },
  });
  res.json({ profile });
});

const docSchema = z.object({
  type: z.enum(["DRIVERS_LICENSE", "NATIONAL_ID", "VEHICLE_PHOTO", "PROFILE_PHOTO", "INSURANCE"]),
  base64: z.string().min(10), // data (no header) 
  ext: z.string().max(5).optional().default("jpg"),
});

// POST /driver/documents
router.post("/documents", async (req, res) => {
  const parsed = docSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid document" });

  const profile = await getOrCreateProfile(req.user.userId);

  // Decode + store
  let buffer;
  try {
    buffer = Buffer.from(parsed.data.base64, "base64");
  } catch {
    return res.status(400).json({ error: "Bad base64" });
  }
  if (buffer.length > 8 * 1024 * 1024) {
    return res.status(413).json({ error: "File too large (max 8MB)" });
  }
  const fileUrl = await storage.saveBuffer(buffer, parsed.data.ext);

  // One document per type — replace if re-uploaded.
  const existing = profile.documents.find((d) => d.type === parsed.data.type);
  let doc;
  if (existing) {
    doc = await prisma.driverDocument.update({
      where: { id: existing.id },
      data: { fileUrl, status: "PENDING" },
    });
  } else {
    doc = await prisma.driverDocument.create({
      data: { profileId: profile.id, type: parsed.data.type, fileUrl },
    });
  }
  res.status(201).json({ document: doc });
});

// The documents required before KYC can be submitted.
const REQUIRED_DOCS = ["DRIVERS_LICENSE", "NATIONAL_ID", "VEHICLE_PHOTO"];

// POST /driver/submit
router.post("/submit", async (req, res) => {
  const profile = await getOrCreateProfile(req.user.userId);

  // Validate completeness
  const missingFields = [];
  if (!profile.fullName) missingFields.push("fullName");
  if (!profile.vehicleType) missingFields.push("vehicleType");
  if (!profile.licensePlate) missingFields.push("licensePlate");

  const haveDocs = new Set(profile.documents.map((d) => d.type));
  const missingDocs = REQUIRED_DOCS.filter((t) => !haveDocs.has(t));

  if (missingFields.length || missingDocs.length) {
    return res.status(400).json({
      error: "KYC incomplete",
      missingFields,
      missingDocs,
    });
  }

  const updated = await prisma.driverProfile.update({
    where: { userId: req.user.userId },
    data: { kycStatus: "PENDING", kycSubmittedAt: new Date() },
    include: { documents: true },
  });

  // HOOK: kick off automated verification here (Onfido/Persona/regional).
  // For dev, an admin approves via POST /admin/drivers/:id/approve (Day 13),
  // or you can auto-approve in dev by setting AUTO_APPROVE_KYC=1.
  if (process.env.AUTO_APPROVE_KYC === "1") {
    await prisma.driverProfile.update({
      where: { userId: req.user.userId },
      data: { kycStatus: "APPROVED" },
    });
    const approved = await prisma.driverProfile.findUnique({
      where: { userId: req.user.userId },
      include: { documents: true },
    });
    return res.json({ profile: approved, autoApproved: true });
  }

  res.json({ profile: updated, autoApproved: false });
});

// --- Day 8: online status, location, accept/decline ---

// Only APPROVED drivers can go online.
const onlineSchema = z.object({ isOnline: z.boolean() });

// POST /driver/online  { isOnline }
router.post("/online", async (req, res) => {
  const parsed = onlineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "isOnline required" });

  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.userId } });
  if (!profile) return res.status(404).json({ error: "No driver profile" });
  if (profile.kycStatus !== "APPROVED") {
    return res.status(403).json({ error: "Your account isn't approved yet" });
  }

  const updated = await prisma.driverProfile.update({
    where: { userId: req.user.userId },
    data: { isOnline: parsed.data.isOnline },
  });
  res.json({ isOnline: updated.isOnline });
});

const locationSchema = z.object({ lat: z.number(), lng: z.number() });

// POST /driver/location  { lat, lng }
router.post("/location", async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "lat and lng required" });

  await prisma.driverProfile.update({
    where: { userId: req.user.userId },
    data: { currentLat: parsed.data.lat, currentLng: parsed.data.lng },
  });

  // If this driver is on an active order, push their location to the customer.
  const active = await prisma.order.findFirst({
    where: {
      driverId: req.user.userId,
      status: { in: ["DRIVER_ASSIGNED", "PICKED_UP", "DELIVERING"] },
    },
  });
  if (active) {
    const { emitToUser } = require("../realtime");
    emitToUser(active.customerId, "driver:location", {
      orderId: active.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
  }

  res.json({ ok: true });
});

const offerActionSchema = z.object({ orderId: z.string().min(1) });

// POST /driver/accept  { orderId }
router.post("/accept", async (req, res) => {
  const parsed = offerActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "orderId required" });

  try {
    const order = await acceptOffer(parsed.data.orderId, req.user.userId);
    res.json({ order });
  } catch (err) {
    if (err.code === "OFFER_GONE") return res.status(409).json({ error: err.message });
    console.error("[/driver/accept]", err.message);
    res.status(500).json({ error: "Could not accept" });
  }
});

// POST /driver/decline  { orderId }
router.post("/decline", async (req, res) => {
  const parsed = offerActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "orderId required" });

  await declineOffer(parsed.data.orderId, req.user.userId);
  res.json({ declined: true });
});

// GET /driver/active — the driver's current active order, if any
router.get("/active", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      driverId: req.user.userId,
      status: { in: ["DRIVER_ASSIGNED", "PICKED_UP", "DELIVERING"] },
    },
    include: { restaurant: { select: { name: true, address: true, lat: true, lng: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ order: order || null });
});

// --- Day 9: delivery lifecycle actions ---

// The driver drives the order forward. Each action validates ownership
// and legal transition. "arrived" is a sub-step of DRIVER_ASSIGNED (a flag,
// not a status), so it doesn't touch the state machine.
const actionSchema = z.object({
  action: z.enum(["arrived", "pickup", "deliver", "complete"]),
});

const ACTION_TO_STATUS = {
  pickup: "PICKED_UP",
  deliver: "DELIVERING",
  complete: "DELIVERED",
};

// POST /driver/order/:id/action  { action }
router.post("/order/:id/action", async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid action" });

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.driverId !== req.user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }

  const { emitToUser } = require("../realtime");

  // "arrived" — flag only, notify customer, no status change.
  if (parsed.data.action === "arrived") {
    if (order.status !== "DRIVER_ASSIGNED") {
      return res.status(409).json({ error: "Can only mark arrived before pickup" });
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { driverArrived: true },
    });
    emitToUser(order.customerId, "order:update", {
      orderId: order.id, status: order.status, driverArrived: true,
    });
    return res.json({ order: updated });
  }

  // Status-advancing actions — go through the state-machine guard.
  const to = ACTION_TO_STATUS[parsed.data.action];
  try {
    // transition() throws ILLEGAL_TRANSITION if the move isn't allowed
    // from the order's current status.
    await transition(order.id, to);

    const extra = {};
    if (to === "PICKED_UP") extra.pickedUpAt = new Date();
    if (to === "DELIVERED") extra.deliveredAt = new Date();
    const updated = Object.keys(extra).length
      ? await prisma.order.update({ where: { id: order.id }, data: extra })
      : await prisma.order.findUnique({ where: { id: order.id } });

    // On completion: record earnings. Order is terminal, so the driver
    // is automatically free for new offers.
    if (to === "DELIVERED") {
      const amount = Number(((order.deliveryFee || 0) + (order.tip || 0)).toFixed(2));
      await prisma.earning.create({
        data: { driverId: req.user.userId, orderId: order.id, amount },
      });
    }

    emitToUser(order.customerId, "order:update", { orderId: order.id, status: to });
    res.json({ order: updated });
  } catch (err) {
    if (err.code === "ILLEGAL_TRANSITION") {
      return res.status(409).json({ error: "That step isn't available right now" });
    }
    console.error("[/driver/order/action]", err.message);
    res.status(500).json({ error: "Could not update order" });
  }
});

// GET /driver/earnings — driver's earnings summary + recent
router.get("/earnings", async (req, res) => {
  const earnings = await prisma.earning.findMany({
    where: { driverId: req.user.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const total = earnings.reduce((s, e) => s + e.amount, 0);
  const today = earnings
    .filter((e) => new Date(e.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, e) => s + e.amount, 0);

  // Currency follows the driver's country.
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  let currency = "AED";
  try {
    const { getCountry } = require("../config/countries");
    currency = getCountry(user?.country || "AE").currency;
  } catch { /* default */ }

  res.json({
    total: Number(total.toFixed(2)),
    today: Number(today.toFixed(2)),
    currency,
    count: earnings.length,
    earnings,
  });
});

module.exports = { router, REQUIRED_DOCS };
