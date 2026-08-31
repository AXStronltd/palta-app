const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const existingCount = await prisma.restaurant.count();
  if (existingCount > 0) {
    console.log(`Seed skipped: ${existingCount} restaurant(s) already exist. This production seed never deletes data.`);
    return;
  }
  console.log("Database has no restaurants yet — safe to add demo data.");

  const adminPhone = "+254700000000";
  let admin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { phone: adminPhone, name: "Palta Admin", role: "ADMIN", country: "KE" },
    });
    console.log(`Admin created: ${adminPhone}`);
  }

  const ownerPhone = "+254711111111";
  let owner = await prisma.user.findUnique({ where: { phone: ownerPhone } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { phone: ownerPhone, name: "Demo Owner", role: "RESTAURANT", country: "KE" },
    });
    console.log(`Owner created: ${ownerPhone}`);
  }

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
    if (exists) { console.log(`Skipped "${r.name}" — already exists.`); continue; }
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

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
