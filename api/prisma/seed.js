// prisma/seed.js (ESM, no dotenv needed)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Wipe in FK-safe order
  await prisma.order.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.restaurant.deleteMany();

  // Ensure an owner user exists (role: restaurant)
  const owner = await prisma.user.upsert({
    where: { email: 'seed-owner@foodable.test' },
    update: {},
    create: {
      email: 'seed-owner@foodable.test',
      name: 'Seed Owner',
      role: 'restaurant',
      // passwordHash is optional in your schema; leaving null is fine
    },
  });

  // Restaurants (must include ownerUserId)
  const r1 = await prisma.restaurant.create({
    data: {
      name: 'Tokyo Bites',
      area: 'Woolloongabba',
      heroUrl:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1600&auto=format&fit=crop',
      ownerUserId: owner.id,
    },
  });
  const r2 = await prisma.restaurant.create({
    data: {
      name: 'Crust & Crumb',
      area: 'West End',
      heroUrl:
        'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1600&auto=format&fit=crop',
      ownerUserId: owner.id,
    },
  });
  const r3 = await prisma.restaurant.create({
    data: {
      name: 'Nonna’s',
      area: 'Fortitude Valley',
      heroUrl:
        'https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1600&auto=format&fit=crop',
      ownerUserId: owner.id,
    },
  });

  // Offers
  await prisma.offer.createMany({
    data: [
      {
        restaurantId: r1.id,
        title: 'Sushi Rescue Box',
        type: 'mystery',
        priceCents: 800,
        originalPriceCents: 2200,
        distanceKm: 1.2,
        pickupStart: '17:30',
        pickupEnd: '19:00',
        qty: 3,
        photoUrl:
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop',
      },
      {
        restaurantId: r2.id,
        title: 'Bakery Mixed Bag',
        type: 'donation',
        priceCents: 500,
        originalPriceCents: 1600,
        distanceKm: 0.7,
        pickupStart: '16:00',
        pickupEnd: '18:00',
        qty: 0,
        photoUrl:
          'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1200&auto=format&fit=crop',
      },
      {
        restaurantId: r3.id,
        title: 'Pasta Family Pack',
        type: 'discount',
        priceCents: 900,
        originalPriceCents: 2400,
        distanceKm: 2.4,
        pickupStart: '19:15',
        pickupEnd: '20:00',
        qty: 5,
        photoUrl:
          'https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1200&auto=format&fit=crop',
      },
    ],
  });

  console.log('Seeded successfully ✅');
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
