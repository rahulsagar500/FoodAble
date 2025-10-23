// src/api/offers.js
import { getRestaurant } from "./restaurants";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Initial sample offers (each tied to a restaurantId).
const _offers = [
  {
    id: "1",
    restaurantId: "r1",
    restaurant: "Tokyo Bites",
    title: "Sushi Rescue Box",
    priceCents: 800,
    originalPriceCents: 2200,
    distanceKm: 1.2,
    pickup: { start: "17:30", end: "19:00" },
    qty: 3,
    type: "mystery",
    photoUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "2",
    restaurantId: "r2",
    restaurant: "Crust & Crumb",
    title: "Bakery Mixed Bag",
    priceCents: 500,
    originalPriceCents: 1600,
    distanceKm: 0.7,
    pickup: { start: "16:00", end: "18:00" },
    qty: 0,
    type: "donation",
    photoUrl:
      "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "3",
    restaurantId: "r3",
    restaurant: "Nonna’s",
    title: "Pasta Family Pack",
    priceCents: 900,
    originalPriceCents: 2400,
    distanceKm: 2.4,
    pickup: { start: "19:15", end: "20:00" },
    qty: 5,
    type: "discount",
    photoUrl:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1200&auto=format&fit=crop",
  },
];

export async function listOffers() {
  await delay(200);
  return _offers.map((o) => ({ ...o }));
}

export async function listOffersByRestaurant(restaurantId) {
  await delay(120);
  return _offers.filter((o) => o.restaurantId === String(restaurantId)).map((o) => ({ ...o }));
}

export async function getOffer(id) {
  await delay(150);
  const found = _offers.find((o) => o.id === String(id));
  if (!found) throw new Error("Offer not found");
  return { ...found };
}

export async function reserveOffer(id) {
  await delay(400);
  const idx = _offers.findIndex((o) => o.id === String(id));
  if (idx === -1) throw new Error("Offer not found");
  if (_offers[idx].qty <= 0) throw new Error("Sold out");
  _offers[idx].qty -= 1;
  return {
    orderId: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    offerId: String(id),
  };
}

// Create a new offer (simulates restaurant upload)
// data = { restaurantId, title, type, price, originalPrice, qty, pickupStart, pickupEnd, photoUrl? }
export async function createOffer(data) {
  await delay(300);
  const rest = await getRestaurant(data.restaurantId); // throws if missing

  const priceCents = Math.round(parseFloat(data.price) * 100);
  const originalPriceCents = Math.round(parseFloat(data.originalPrice) * 100);
  if (!isFinite(priceCents) || !isFinite(originalPriceCents)) {
    throw new Error("Invalid prices");
  }

  const newOffer = {
    id: String(Date.now()),
    restaurantId: rest.id,
    restaurant: rest.name, // keep this for existing UI
    title: String(data.title || "").trim(),
    type: data.type || "discount", // 'discount' | 'mystery' | 'donation'
    priceCents,
    originalPriceCents,
    distanceKm: 1.0,
    pickup: { start: data.pickupStart || "17:00", end: data.pickupEnd || "19:00" },
    qty: Math.max(0, parseInt(data.qty || "0", 10)),
    photoUrl: data.photoUrl || rest.heroUrl,
  };

  _offers.push(newOffer);
  return { ...newOffer };
}

export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
