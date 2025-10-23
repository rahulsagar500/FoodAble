// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// --- Seed data ---
const restaurants = [
  {
    id: "r1",
    name: "Tokyo Bites",
    area: "Woolloongabba",
    heroUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r2",
    name: "Crust & Crumb",
    area: "West End",
    heroUrl:
      "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r3",
    name: "Nonna’s",
    area: "Fortitude Valley",
    heroUrl:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1600&auto=format&fit=crop",
  },
];

const offers = [
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

// --- Health ---
app.get("/api/health", (req, res) => res.json({ ok: true }));

// --- Restaurants ---
app.get("/api/restaurants", (req, res) => res.json(restaurants));

app.get("/api/restaurants/:id", (req, res) => {
  const r = restaurants.find((x) => x.id === String(req.params.id));
  if (!r) return res.status(404).json({ error: "Restaurant not found" });
  res.json(r);
});

app.get("/api/restaurants/:id/offers", (req, res) => {
  const id = String(req.params.id);
  res.json(offers.filter((o) => o.restaurantId === id));
});

// --- Offers ---
app.get("/api/offers", (req, res) => res.json(offers));

app.get("/api/offers/:id", (req, res) => {
  const o = offers.find((x) => x.id === String(req.params.id));
  if (!o) return res.status(404).json({ error: "Offer not found" });
  res.json(o);
});

app.post("/api/offers", (req, res) => {
  const {
    restaurantId,
    title,
    type = "discount",
    price,
    originalPrice,
    qty = 0,
    pickupStart = "17:00",
    pickupEnd = "19:00",
    photoUrl,
  } = req.body || {};

  const rest = restaurants.find((r) => r.id === String(restaurantId));
  if (!rest) return res.status(400).json({ error: "Invalid restaurantId" });

  const priceCents = Math.round(Number(price) * 100);
  const origCents = Math.round(Number(originalPrice) * 100);
  if (!Number.isFinite(priceCents) || !Number.isFinite(origCents)) {
    return res.status(400).json({ error: "Invalid prices" });
  }

  const newOffer = {
    id: String(Date.now()),
    restaurantId: rest.id,
    restaurant: rest.name,
    title: String(title || "").trim(),
    type,
    priceCents,
    originalPriceCents: origCents,
    distanceKm: 1.0,
    pickup: { start: pickupStart, end: pickupEnd },
    qty: Math.max(0, parseInt(qty, 10) || 0),
    photoUrl: photoUrl || rest.heroUrl,
  };

  offers.push(newOffer);
  res.status(201).json(newOffer);
});

app.post("/api/offers/:id/reserve", (req, res) => {
  const idx = offers.findIndex((o) => o.id === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Offer not found" });
  if (offers[idx].qty <= 0) return res.status(409).json({ error: "Sold out" });

  offers[idx].qty -= 1;
  res.json({
    orderId: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    offerId: String(req.params.id),
  });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
