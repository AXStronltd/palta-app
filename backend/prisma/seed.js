// Seed restaurants + menu items so browse/search/filter is meaningful.
// (Restaurant model = Palta ops adds restaurants.)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DATA = [
  {
    name: "Nova Burgers", cuisineType: "Burgers", rating: 4.7, deliveryFee: 2.5,
    estimatedPrepTime: 18, lat: 25.2048, lng: 55.2708, address: "12 Marina Walk",
    description: "Smash burgers & loaded fries.",
    menu: [
      ["Classic Smash", "Double patty, cheese, house sauce", 9.0, "Burgers", {
        groups: [
          { group: "Add-ons", required: false, multi: true, choices: [
            { id: "cheese", name: "Extra cheese", price: 1.0 },
            { id: "bacon", name: "Bacon", price: 1.5 },
            { id: "egg", name: "Fried egg", price: 1.0 },
          ]},
          { group: "Cook", required: true, multi: false, choices: [
            { id: "medium", name: "Medium", price: 0 },
            { id: "welldone", name: "Well done", price: 0 },
          ]},
        ],
      }],
      ["Spicy Nova", "Jalapeño, chipotle mayo", 10.5, "Burgers", null],
      ["Loaded Fries", "Cheese, bacon, chives", 6.0, "Sides", null],
      ["Milkshake", "Vanilla or chocolate", 4.5, "Drinks", {
        groups: [
          { group: "Flavor", required: true, multi: false, choices: [
            { id: "vanilla", name: "Vanilla", price: 0 },
            { id: "chocolate", name: "Chocolate", price: 0 },
            { id: "strawberry", name: "Strawberry", price: 0.5 },
          ]},
        ],
      }],
    ],
  },
  {
    name: "Sakura Express", cuisineType: "Japanese", rating: 4.5, deliveryFee: 3.0,
    estimatedPrepTime: 25, lat: 25.21, lng: 55.28, address: "5 Downtown Blvd",
    description: "Fresh sushi, fast.",
    menu: [
      ["Salmon Nigiri (4pc)", "", 8.0, "Nigiri"],
      ["California Roll", "", 7.5, "Rolls"],
      ["Chicken Katsu", "Panko chicken, curry sauce", 11.0, "Mains"],
      ["Miso Soup", "", 3.0, "Sides"],
      ["Green Tea", "", 2.0, "Drinks"],
    ],
  },
  {
    name: "Olive & Thyme", cuisineType: "Mediterranean", rating: 4.8, deliveryFee: 1.5,
    estimatedPrepTime: 22, lat: 25.19, lng: 55.26, address: "88 Garden Rd",
    description: "Fresh mezze, grills & salads.",
    menu: [
      ["Chicken Shawarma Wrap", "Garlic sauce, pickles", 7.0, "Wraps"],
      ["Falafel Plate", "Hummus, tahini, salad", 8.5, "Plates"],
      ["Greek Salad", "Feta, olives, cucumber", 6.5, "Salads"],
      ["Baklava", "Honey & pistachio", 4.0, "Desserts"],
    ],
  },
  {
    name: "Pronto Pizza", cuisineType: "Italian", rating: 4.3, deliveryFee: 2.0,
    estimatedPrepTime: 30, lat: 25.20, lng: 55.27, address: "3 Piazza Lane",
    description: "Wood-fired pizza & pasta.",
    menu: [
      ["Margherita", "San Marzano, basil, mozzarella", 10.0, "Pizza"],
      ["Pepperoni", "Double pepperoni", 12.0, "Pizza"],
      ["Spaghetti Carbonara", "Guanciale, pecorino", 11.5, "Pasta"],
      ["Garlic Bread", "", 4.5, "Sides"],
    ],
  },
  {
    name: "Green Bowl", cuisineType: "Healthy", rating: 4.6, deliveryFee: 2.5,
    estimatedPrepTime: 15, lat: 25.22, lng: 55.29, address: "21 Wellness St",
    description: "Grain bowls, smoothies & wraps.",
    menu: [
      ["Poke Bowl", "Salmon, avocado, edamame", 12.5, "Bowls"],
      ["Quinoa Power Bowl", "Chickpea, kale, tahini", 10.0, "Bowls"],
      ["Berry Smoothie", "", 5.5, "Drinks"],
      ["Avocado Toast", "Sourdough, chili flakes", 7.0, "Snacks"],
    ],
  },
  {
    name: "Spice Route", cuisineType: "Indian", rating: 4.4, deliveryFee: 3.5,
    estimatedPrepTime: 28, lat: 25.18, lng: 55.25, address: "7 Curry Court",
    description: "North Indian classics.",
    menu: [
      ["Butter Chicken", "Creamy tomato gravy", 12.0, "Curries"],
      ["Paneer Tikka", "Char-grilled cottage cheese", 10.5, "Starters"],
      ["Garlic Naan", "", 3.0, "Breads"],
      ["Mango Lassi", "", 4.0, "Drinks"],
    ],
  },
  {
    name: "Taco Libre", cuisineType: "Mexican", rating: 4.2, deliveryFee: 2.0,
    estimatedPrepTime: 20, lat: 25.205, lng: 55.275, address: "15 Fiesta Ave",
    description: "Street tacos & burritos.",
    menu: [
      ["Al Pastor Tacos (3)", "Pineapple, cilantro", 9.0, "Tacos"],
      ["Beef Burrito", "Rice, beans, cheese", 10.0, "Burritos"],
      ["Guacamole & Chips", "", 5.0, "Sides"],
      ["Horchata", "", 3.5, "Drinks"],
    ],
  },
  {
    name: "Dragon Wok", cuisineType: "Chinese", rating: 4.1, deliveryFee: 2.5,
    estimatedPrepTime: 24, lat: 25.215, lng: 55.285, address: "9 Lantern St",
    description: "Wok classics & dim sum.",
    menu: [
      ["Kung Pao Chicken", "Peanuts, chili", 11.0, "Mains"],
      ["Veg Spring Rolls (4)", "", 5.0, "Starters"],
      ["Egg Fried Rice", "", 6.5, "Rice"],
      ["Jasmine Tea", "", 2.0, "Drinks"],
    ],
  },
];

async function main() {
  // Clear existing (idempotent seed)
  await prisma.menuItem.deleteMany({});
  await prisma.restaurant.deleteMany({});

  // Ensure an admin user exists for the ops console.
  const adminPhone = "+9715550000";
  const existingAdmin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!existingAdmin) {
    await prisma.user.create({ data: { phone: adminPhone, name: "Palta Admin", role: "ADMIN" } });
    console.log(`Admin user created: ${adminPhone} (log into the ops console with this + OTP)`);
  }

  // Ensure a restaurant-owner user exists for the restaurant dashboard.
  const ownerPhone = "+9715551111";
  let owner = await prisma.user.findUnique({ where: { phone: ownerPhone } });
  if (!owner) {
    owner = await prisma.user.create({ data: { phone: ownerPhone, name: "Nova Owner", role: "RESTAURANT" } });
    console.log(`Restaurant owner created: ${ownerPhone} (log into the restaurant dashboard with this + OTP)`);
  }

  let first = true;
  for (const r of DATA) {
    await prisma.restaurant.create({
      data: {
        ownerId: first ? owner.id : null, // first restaurant is owned by the demo owner
        name: r.name, description: r.description, cuisineType: r.cuisineType,
        rating: r.rating, deliveryFee: r.deliveryFee, estimatedPrepTime: r.estimatedPrepTime,
        lat: r.lat, lng: r.lng, address: r.address,
        menuItems: {
          create: r.menu.map((row) => {
            const [name, description, price, category, options] = row;
            return {
              name,
              description: description || null,
              price,
              category,
              options: options || undefined,
            };
          }),
        },
      },
    });
    first = false;
  }
  console.log(`Seeded ${DATA.length} restaurants with menus.`);
  console.log(`Nova Burgers is owned by ${ownerPhone} — log into the restaurant dashboard with it.`);

  // A couple of non-restaurant shops so customers can browse both.
  const SHOPS = [
    { name: "FreshMart Grocery", merchantType: "GROCERY", cuisineType: "Grocery",
      description: "Everyday groceries, delivered.", lat: 25.21, lng: 55.28, address: "8 Market St",
      deliveryFee: 1.5, estimatedPrepTime: 15,
      menu: [["Milk 1L", "Full-fat", 1.8, "Dairy"], ["Bananas 1kg", "", 2.2, "Produce"],
             ["Eggs (12)", "Free-range", 3.5, "Dairy"], ["Bread", "Whole wheat loaf", 2.0, "Bakery"]] },
    { name: "CarePlus Pharmacy", merchantType: "PHARMACY", cuisineType: "Pharmacy",
      description: "Health & wellness essentials.", lat: 25.19, lng: 55.26, address: "22 Health Ave",
      deliveryFee: 2.0, estimatedPrepTime: 20,
      menu: [["Paracetamol 500mg", "16 tablets", 3.0, "Medicine"], ["Vitamin C", "1000mg, 30 tabs", 6.5, "Supplements"],
             ["Hand sanitizer", "250ml", 4.0, "Hygiene"], ["Face masks (10)", "", 5.0, "Hygiene"]] },
  ];
  for (const s of SHOPS) {
    await prisma.restaurant.create({
      data: {
        merchantType: s.merchantType, country: "AE", currency: "AED", name: s.name, description: s.description,
        cuisineType: s.cuisineType, rating: 4.6, deliveryFee: s.deliveryFee,
        estimatedPrepTime: s.estimatedPrepTime, lat: s.lat, lng: s.lng, address: s.address,
        menuItems: { create: s.menu.map(([name, description, price, category]) => ({
          name, description: description || null, price, category,
        })) },
      },
    });
  }
  console.log(`Seeded ${SHOPS.length} non-restaurant shops (grocery, pharmacy).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
