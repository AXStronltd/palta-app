// PRODUCTION-SAFE seed.
// Difference from prisma/seed.js: this NEVER deletes or resets anything.
// - It skips seeding entirely if restaurants already exist (so it will not
//   duplicate data if you run it twice).
// - It only adds a restaurant if one with the same name isn't already there.
// - Admin / owner users are created only if missing (findUnique first).
//
// Safe to run against a live database. Run once:
//   node prisma/seed.prod.js
//
// It reuses the exact same DATA + SHOPS from the dev seed so there's one
// source of truth — we just require it and re-export the arrays.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Pull the datasets out of the dev seed without running it.
// (The dev seed only runs on `node prisma/seed.js` directly, not on require,
//  because its main() is invoked at the bottom — so we inline the data here
//  instead to be 100% sure nothing destructive executes.)
//
// To keep it simple and safe, we re-declare the minimal data inline. If you
// want the full dev dataset, copy the DATA/SHOPS arrays from seed.js into here.

async function main() {
  // ---- SAFETY GUARD 1: never wipe. If data exists, do nothing. ----
  const existingCount = await prisma.restaurant.count();
  if (existingCount > 0) {
    console.log(
      `Seed skipped: ${existingCount} restaurant(s) already exist. ` +
      `This production seed never deletes data.`
    );
    return;
  }

  console.log("Database has no restaurants yet — safe to add demo data.");

  // ---- Admin user (only if missing) ----
  const adminPhone = "+254700000000"; // Kenya number for the launch market
  let admin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { phone: adminPhone, name: "Palta Admin", role: "ADMIN", country: "KE" },
    });
    console.log(`Admin created: ${adminPhone} (log into ops console with this + OTP)`);
  }

  // ---- One demo restaurant owner (only if missing) ----
  const ownerPhone = "+254711111111";
  let owner = await prisma.user.findUnique({ where: { phone: ownerPhone } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { phone: ownerPhone, name: "Demo Owner", role: "RESTAURANT", country: "KE" },
    });
    console.log(`Owner created: ${ownerPhone}`);
  }

  // ---- A couple of Nairobi demo restaurants (only if not already present) ----
  const DEMO = [
    {
      name: "Mama Mia Pizzeria", cuisineType: "Pizza", rating: 4.7, deliveryFee: 150,
      estimatedPrepTime: 25, lat: -1.3009, lng: 36.7809, address: "Karen, Nairobi",
      currency: "KES", country: "KE", description: "Wood-fired pizza in Karen.",
      menu: [
        ["Margherita", "Classic tomato & mozzarella", 850, "Pizza", null],
        ["Pepperoni", "Loaded pepperoni", 950, "Pizza", null],
        ["Garlic Bread", "", 350, "Sides", null],
      ],
    },
    {
      name: "Quickmart Karen", cuisineType: "Grocery", rating: 4.8, deliveryFee: 150,
      estimatedPrepTime: 20, lat: -1.319, lng: 36.712, address: "Karen, Nairobi",
      currency: "KES", country: "KE", description: "Everyday groceries, delivered.",
      merchantType: "GROCERY",
      menu: [
        ["Bananas (1kg)", "", 90, "Fresh Produce", null],
        ["Brookside Milk 1L", "", 120, "Dairy", null],
        ["Fresh White Bread", "", 65, "Bakery", null],
      ],
    },
  ];

  let firstDone = false;
  for (const r of DEMO) {
    const exists = await prisma.restaurant.findFirst({ where: { name: r.name } });
    if (exists) {
      console.log(`Skipped "${r.name}" — already exists.`);
      continue;
    }
    await prisma.restaurant.create({
      data: {
        ownerId: !firstDone ? owner.id : null,
        name: r.name, description: r.description, cuisineType: r.cuisineType,
        rating: r.rating, deliveryFee: r.deliveryFee, estimatedPrepTime: r.estimatedPrepTime,
        lat: r.lat, lng: r.lng, address: r.address,
        currency: r.currency, country: r.country,
        ...(r.merchantType ? { merchantType: r.merchantType } : {}),
        menuItems: {
          create: r.menu.map(([name, description, price, category, options]) => ({
            name, description: description || null, price, category, options: options || undefined,
          })),
        },
      },
    });
    console.log(`Added "${r.name}".`);
    firstDone = true;
  }

  console.log("Production-safe seed complete. No existing data was touched.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
