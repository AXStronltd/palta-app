// Restaurant routes — browse, search, filter, sort + single restaurant.

const express = require("express");
const { prisma } = require("../prisma");

const router = express.Router();

// GET /restaurants
//   ?q=            search restaurant name/cuisine AND dish names
//   ?cuisine=      exact cuisine filter (repeatable: ?cuisine=Burgers&cuisine=Japanese)
//   ?maxDeliveryFee=  number
//   ?minRating=    number
//   ?maxPrepTime=  minutes
//   ?sort=         "rating" | "prepTime" | "deliveryFee"  (default rating)
router.get("/", async (req, res) => {
  const {
    q,
    cuisine,
    type,
    maxDeliveryFee,
    minRating,
    maxPrepTime,
    sort = "rating",
  } = req.query;

  // Build the where clause
  const where = { isOpen: true, AND: [] };

  // Filter by merchant type (RESTAURANT / GROCERY / PHARMACY / RETAIL / CONVENIENCE)
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    where.AND.push({ merchantType: { in: types } });
  }

  if (q && q.trim()) {
    const term = q.trim();
    // Match restaurant name/cuisine OR a dish name on the restaurant's menu.
    where.AND.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { cuisineType: { contains: term, mode: "insensitive" } },
        { menuItems: { some: { name: { contains: term, mode: "insensitive" } } } },
      ],
    });
  }

  if (cuisine) {
    const cuisines = Array.isArray(cuisine) ? cuisine : [cuisine];
    where.AND.push({ cuisineType: { in: cuisines } });
  }
  if (maxDeliveryFee) where.AND.push({ deliveryFee: { lte: Number(maxDeliveryFee) } });
  if (minRating) where.AND.push({ rating: { gte: Number(minRating) } });
  if (maxPrepTime) where.AND.push({ estimatedPrepTime: { lte: Number(maxPrepTime) } });

  if (where.AND.length === 0) delete where.AND;

  // Sorting
  const orderBy =
    sort === "prepTime"
      ? { estimatedPrepTime: "asc" }
      : sort === "deliveryFee"
      ? { deliveryFee: "asc" }
      : { rating: "desc" };

  const restaurants = await prisma.restaurant.findMany({ where, orderBy });
  res.json({ restaurants, count: restaurants.length });
});

// GET /restaurants/cuisines — distinct cuisine list for filter chips
router.get("/cuisines", async (_req, res) => {
  const rows = await prisma.restaurant.findMany({
    where: { isOpen: true },
    select: { cuisineType: true },
    distinct: ["cuisineType"],
    orderBy: { cuisineType: "asc" },
  });
  res.json({ cuisines: rows.map((r) => r.cuisineType) });
});

// GET /restaurants/:id — one restaurant with its available menu
router.get("/:id", async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
    include: { menuItems: { where: { isAvailable: true } } },
  });
  if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
  res.json({ restaurant });
});

module.exports = router;
