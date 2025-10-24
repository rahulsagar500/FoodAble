// prisma/seed.js (CommonJS)
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // clear previous data
  await prisma.order.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.restaurant.deleteMany();

  // restaurants
  const r1 = await prisma.restaurant.create({
    data: {
      name: "Tokyo Bites",
      area: "Woolloongabba",
      heroUrl:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1600&auto=format&fit=crop",
    },
  });
  const r2 = await prisma.restaurant.create({
    data: {
      name: "Crust & Crumb",
      area: "West End",
      heroUrl:
        "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1600&auto=format&fit=crop",
    },
  });
  const r3 = await prisma.restaurant.create({
    data: {
      name: "Nonna’s",
      area: "Fortitude Valley",
      heroUrl:
        "https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1600&auto=format&fit=crop",
    },
  });

  // offers
  await prisma.offer.createMany({
    data: [
      {
        restaurantId: r1.id,
        title: "Sushi Rescue Box",
        type: "mystery",
        priceCents: 800,
        originalPriceCents: 2200,
        distanceKm: 1.2,
        pickupStart: "17:30",
        pickupEnd: "19:00",
        qty: 3,
        photoUrl:
          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop",
      },
      {
        restaurantId: r2.id,
        title: "Bakery Mixed Bag",
        type: "donation",
        priceCents: 500,
        originalPriceCents: 1600,
        distanceKm: 0.7,
        pickupStart: "16:00",
        pickupEnd: "18:00",
        qty: 0,
        photoUrl:
          "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1200&auto=format&fit=crop",
      },
      {
        restaurantId: r3.id,
        title: "Pasta Family Pack",
        type: "discount",
        priceCents: 900,
        originalPriceCents: 2400,
        distanceKm: 2.4,
        pickupStart: "19:15",
        pickupEnd: "20:00",
        qty: 5,
        photoUrl:
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1200&auto=format&fit=crop",
      },
    ],
  });

  console.log("Seeded successfully ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
