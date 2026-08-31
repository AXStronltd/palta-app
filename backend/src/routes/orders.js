// Order routes — place an order, list your orders, get one, cancel.

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { createOrder, transition } = require("../services/order");
const { provider } = require("../services/payment");

const router = express.Router();
router.use(requireAuth);

const lineSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().min(1).max(20),
  options: z.array(z.object({ id: z.string(), name: z.string(), price: z.number() })).optional(),
  notes: z.string().max(200).optional(),
});

const placeSchema = z.object({
  restaurantId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
  tip: z.number().min(0).optional().default(0),
  deliveryAddress: z.string().max(300).optional().default(""),
  deliveryType: z.enum(["DELIVERY", "PICKUP"]).optional().default("DELIVERY"),
  paymentMethod: z.enum(["card", "cash"]).optional().default("card"),
  currency: z.string().length(3).optional().default("usd"),
});

// POST /orders — place an order
router.post("/", async (req, res) => {
  const parsed = placeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid order", detail: parsed.error.issues });
  }
  const { restaurantId, lines, tip, deliveryAddress, deliveryType, paymentMethod } = parsed.data;

  try {
    // Resolve the merchant's country → currency + the right payment provider.
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
    const countryCode = restaurant.country || "AE";
    const orderCurrency = restaurant.currency || "AED";

    // 1. Create the order (server recomputes all prices), stamped with country/currency.
    const order = await createOrder({
      customerId: req.user.userId,
      restaurantId,
      lines,
      tip,
      deliveryAddress,
      deliveryType,
      currency: orderCurrency,
      country: countryCode,
    });

    // 2. Payment — provider chosen by the merchant's country.
    let payment;
    if (paymentMethod === "cash") {
      payment = { provider: "cash", clientSecret: null, paymentIntentId: null, mock: false };
    } else {
      const { paymentFor } = require("../config/resolver");
      const paymentProvider = paymentFor(countryCode);
      payment = await paymentProvider.createPaymentIntent({
        amount: order.total,
        currency: orderCurrency,
        orderId: order.id,
      });
    }

    // Notify the restaurant owner (if linked) of the new incoming order.
    if (restaurant.ownerId) {
      const { emitToUser } = require("../realtime");
      emitToUser(restaurant.ownerId, "order:new", { orderId: order.id });
    }

    // 3. Return the order + how to complete payment (clientSecret for card).
    res.status(201).json({ order, payment });
  } catch (err) {
    console.error("[POST /orders]", err.message);
    res.status(400).json({ error: err.message });
  }
});

// GET /orders — the customer's orders, newest first
router.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { customerId: req.user.userId },
    orderBy: { createdAt: "desc" },
    include: { restaurant: { select: { name: true, cuisineType: true } } },
  });
  res.json({ orders });
});

// GET /orders/:id — one order (must belong to the customer), enriched
// with driver details + live location once a driver is assigned.
router.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      restaurant: { select: { name: true, address: true, lat: true, lng: true } },
      driver: { select: { id: true, name: true } },
    },
  });
  if (!order || order.customerId !== req.user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Attach driver profile (vehicle, plate, live location) if assigned.
  let driverProfile = null;
  if (order.driverId) {
    driverProfile = await prisma.driverProfile.findUnique({
      where: { userId: order.driverId },
      select: { vehicleType: true, vehicleMake: true, vehicleModel: true, vehicleColor: true, licensePlate: true, currentLat: true, currentLng: true },
    });
  }

  res.json({ order: { ...order, driverProfile } });
});

// POST /orders/:id/cancel — customer cancels (only while cancellable)
router.post("/:id/cancel", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.customerId !== req.user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }
  try {
    const updated = await transition(order.id, "CANCELLED");
    res.json({ order: updated });
  } catch (err) {
    if (err.code === "ILLEGAL_TRANSITION") {
      return res.status(409).json({ error: "This order can no longer be cancelled" });
    }
    throw err;
  }
});

// --- Day 12: ratings, receipts, reorder ---

const ratingSchema = z.object({
  foodRating: z.number().int().min(1).max(5),
  driverRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

// POST /orders/:id/rate — rate a delivered order (once)
router.post("/:id/rate", async (req, res) => {
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "foodRating (1-5) required" });

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { rating: true },
  });
  if (!order || order.customerId !== req.user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (order.status !== "DELIVERED") {
    return res.status(409).json({ error: "You can only rate a delivered order" });
  }
  if (order.rating) {
    return res.status(409).json({ error: "You've already rated this order" });
  }

  const rating = await prisma.rating.create({
    data: {
      orderId: order.id,
      customerId: req.user.userId,
      restaurantId: order.restaurantId,
      driverId: order.driverId,
      foodRating: parsed.data.foodRating,
      driverRating: parsed.data.driverRating ?? null,
      comment: parsed.data.comment || null,
    },
  });

  // Update the restaurant's rolling average.
  const agg = await prisma.rating.aggregate({
    where: { restaurantId: order.restaurantId },
    _avg: { foodRating: true },
  });
  if (agg._avg.foodRating != null) {
    await prisma.restaurant.update({
      where: { id: order.restaurantId },
      data: { rating: Number(agg._avg.foodRating.toFixed(1)) },
    });
  }

  res.status(201).json({ rating });
});

// GET /orders/:id/receipt — a structured receipt
router.get("/:id/receipt", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { restaurant: { select: { name: true, address: true } } },
  });
  if (!order || order.customerId !== req.user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json({
    receipt: {
      orderId: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      currency: order.currency,
      restaurant: order.restaurant?.name,
      restaurantAddress: order.restaurant?.address,
      placedAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      deliveryType: order.deliveryType,
      deliveryAddress: order.deliveryAddress,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      tip: order.tip,
      total: order.total,
      status: order.status,
    },
  });
});

// GET /orders/:id/reorder — returns cart-ready lines from a past order,
// re-validated against the current menu (prices/availability may have changed).
router.get("/:id/reorder", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.customerId !== req.user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: order.restaurantId } });
  if (!restaurant || !restaurant.isOpen) {
    return res.status(409).json({ error: "This restaurant isn't available right now" });
  }

  const menuItems = await prisma.menuItem.findMany({ where: { restaurantId: order.restaurantId } });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  const lines = [];
  const unavailable = [];
  for (const it of order.items) {
    const item = byId.get(it.menuItemId);
    if (item && item.isAvailable) {
      lines.push({
        menuItemId: item.id,
        name: item.name,
        price: item.price, // current price
        quantity: it.quantity,
        options: it.options || [],
        notes: it.notes || "",
      });
    } else {
      unavailable.push(it.name);
    }
  }

  res.json({
    restaurant: { id: restaurant.id, name: restaurant.name, deliveryFee: restaurant.deliveryFee },
    lines,
    unavailable,
  });
});

module.exports = router;
