// server.js (DB-backed)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Helpers
const mapOffer = (o) => ({
  id: o.id,
  restaurantId: o.restaurantId,
  restaurant: o.restaurant ? o.restaurant.name : undefined,
  title: o.title,
  type: o.type,
  priceCents: o.priceCents,
  originalPriceCents: o.originalPriceCents,
  distanceKm: o.distanceKm,
  pickup: { start: o.pickupStart, end: o.pickupEnd },
  qty: o.qty,
  photoUrl: o.photoUrl,
});

// Health
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "db_unavailable" });
  }
});

// Restaurants
app.get("/api/restaurants", async (req, res, next) => {
  try {
    const rs = await prisma.restaurant.findMany({ orderBy: { name: "asc" } });
    res.json(rs);
  } catch (e) {
    next(e);
  }
});

app.get("/api/restaurants/:id", async (req, res, next) => {
  try {
    const r = await prisma.restaurant.findUnique({ where: { id: String(req.params.id) } });
    if (!r) return res.status(404).json({ error: "Restaurant not found" });
    res.json(r);
  } catch (e) {
    next(e);
  }
});

app.get("/api/restaurants/:id/offers", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const os = await prisma.offer.findMany({
      where: { restaurantId: id },
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(os.map(mapOffer));
  } catch (e) {
    next(e);
  }
});

// Offers
app.get("/api/offers", async (req, res, next) => {
  try {
    const os = await prisma.offer.findMany({
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(os.map(mapOffer));
  } catch (e) {
    next(e);
  }
});

app.get("/api/offers/:id", async (req, res, next) => {
  try {
    const o = await prisma.offer.findUnique({
      where: { id: String(req.params.id) },
      include: { restaurant: true },
    });
    if (!o) return res.status(404).json({ error: "Offer not found" });
    res.json(mapOffer(o));
  } catch (e) {
    next(e);
  }
});

app.post("/api/offers", async (req, res, next) => {
  try {
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

    // Validate restaurant
    const rest = await prisma.restaurant.findUnique({ where: { id: String(restaurantId) } });
    if (!rest) return res.status(400).json({ error: "Invalid restaurantId" });

    const priceCents = Math.round(Number(price) * 100);
    const origCents = Math.round(Number(originalPrice) * 100);
    if (!Number.isFinite(priceCents) || !Number.isFinite(origCents)) {
      return res.status(400).json({ error: "Invalid prices" });
    }

    const created = await prisma.offer.create({
      data: {
        restaurantId: rest.id,
        title: String(title || "").trim(),
        type,
        priceCents,
        originalPriceCents: origCents,
        distanceKm: 1.0,
        pickupStart,
        pickupEnd,
        qty: Math.max(0, parseInt(qty, 10) || 0),
        photoUrl: photoUrl || rest.heroUrl,
      },
      include: { restaurant: true },
    });

    res.status(201).json(mapOffer(created));
  } catch (e) {
    next(e);
  }
});

app.post("/api/offers/:id/reserve", async (req, res, next) => {
  const id = String(req.params.id);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id } });
      if (!offer) return { status: 404, error: "Offer not found" };
      if (offer.qty <= 0) return { status: 409, error: "Sold out" };

      await tx.offer.update({
        where: { id },
        data: { qty: { decrement: 1 } },
      });

      const order = await tx.order.create({
        data: { offerId: id, status: "reserved" },
      });

      return { status: 200, order };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ orderId: result.order.id, offerId: id });
  } catch (e) {
    next(e);
  }
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
