// Address routes — a customer's saved delivery locations.
// All require auth; a user only ever sees/edits their own addresses.

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const addressSchema = z.object({
  label: z.string().min(1).max(40),
  lat: z.number(),
  lng: z.number(),
  fullAddress: z.string().min(1).max(300),
  notes: z.string().max(300).optional(),
});

// GET /addresses — the user's saved addresses
router.get("/", async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.userId },
    orderBy: { id: "desc" },
  });
  res.json({ addresses });
});

// POST /addresses — add one
router.post("/", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid address" });

  const address = await prisma.address.create({
    data: { ...parsed.data, userId: req.user.userId },
  });
  res.status(201).json({ address });
});

// PATCH /addresses/:id — edit label/notes/coords
router.patch("/:id", async (req, res) => {
  const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user.userId) {
    return res.status(404).json({ error: "Address not found" });
  }
  const parsed = addressSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update" });

  const address = await prisma.address.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({ address });
});

// DELETE /addresses/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user.userId) {
    return res.status(404).json({ error: "Address not found" });
  }
  await prisma.address.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});

module.exports = router;
