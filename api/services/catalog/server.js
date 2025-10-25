import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

const PORT = 4002;
const JWT_SECRET = process.env.JWT_SECRET || "dev";
const COOKIE_NAME = process.env.COOKIE_NAME || "token";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: [FRONTEND_ORIGIN, "http://localhost:5174"], credentials: true }));

function parseUser(req, _res, next) {
  const tok = req.cookies?.[COOKIE_NAME];
  if (tok) { try { req.auth = jwt.verify(tok, JWT_SECRET); } catch {} }
  next();
}
async function loadUser(req) {
  if (!req.auth?.uid) return null;
  return prisma.user.findUnique({ where: { id: req.auth.uid } });
}
function requireRole(...roles) {
  return async (req, res, next) => {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ code: "unauthenticated" });
    if (roles.length && !roles.includes(user.role)) return res.status(403).json({ code: "forbidden" });
    req.user = user; next();
  };
}
app.use(parseUser);

app.get("/healthz", (_r, s) => s.send("ok"));

const mapOffer = (o, rest) => ({
  id: o.id,
  title: o.title,
  type: o.type,
  priceCents: o.priceCents,
  originalPriceCents: o.originalPriceCents,
  distanceKm: o.distanceKm ?? 1.0,
  pickup: { start: o.pickupStart, end: o.pickupEnd },
  qty: o.qty,
  photoUrl: o.photoUrl || null,
  restaurant: rest ? { id: rest.id, name: rest.name } : undefined
});

/** Public browse */
app.get("/api/restaurants", async (_req, res) => {
  const rows = await prisma.restaurant.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows);
});
app.get("/api/restaurants/:id", async (req, res) => {
  const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ code: "not_found" });
  res.json(r);
});
app.get("/api/restaurants/:id/offers", async (req, res) => {
  const offers = await prisma.offer.findMany({ where: { restaurantId: req.params.id }, orderBy: { createdAt: "desc" } });
  res.json(offers.map((o) => mapOffer(o)));
});
app.get("/api/offers", async (_req, res) => {
  const offers = await prisma.offer.findMany({
    orderBy: { createdAt: "desc" },
    include: { restaurant: { select: { id: true, name: true } } }
  });
  res.json(offers.map((o) => mapOffer(o, o.restaurant)));
});
app.get("/api/offers/:id", async (req, res) => {
  const o = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { restaurant: { select: { id: true, name: true } } }
  });
  if (!o) return res.status(404).json({ code: "not_found" });
  res.json(mapOffer(o, o.restaurant));
});

/** Owner portal */
app.get("/api/me/restaurant", requireRole("restaurant", "admin"), async (req, res) => {
  const r = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
  res.json(r || null);
});
app.post("/api/me/restaurant", requireRole("restaurant", "admin"), async (req, res) => {
  const { name, area, heroUrl } = req.body || {};
  if (!name || !heroUrl) return res.status(400).json({ code: "validation_error" });

  const existing = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
  const r = existing
    ? await prisma.restaurant.update({ where: { id: existing.id }, data: { name, area: area || null, heroUrl } })
    : await prisma.restaurant.create({ data: { name, area: area || null, heroUrl, ownerUserId: req.user.id } });
  res.json(r);
});
app.get("/api/me/offers", requireRole("restaurant", "admin"), async (req, res) => {
  const r = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
  if (!r) return res.json([]);
  const offers = await prisma.offer.findMany({ where: { restaurantId: r.id }, orderBy: { createdAt: "desc" } });
  res.json(offers.map((o) => mapOffer(o)));
});
app.post("/api/offers", requireRole("restaurant", "admin"), async (req, res) => {
  const r = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
  if (!r) return res.status(400).json({ code: "no_restaurant" });

  const { title, type, price, originalPrice, qty, pickupStart, pickupEnd, photoUrl } = req.body || {};
  if (!title || !price || !originalPrice || !pickupStart || !pickupEnd)
    return res.status(400).json({ code: "validation_error" });

  const created = await prisma.offer.create({
    data: {
      restaurantId: r.id,
      title,
      type: type || "discount",
      priceCents: Math.round(Number(price) * 100),
      originalPriceCents: Math.round(Number(originalPrice) * 100),
      qty: Number(qty || 0),
      pickupStart, pickupEnd,
      photoUrl: photoUrl || null
    }
  });
  res.json(mapOffer(created));
});
app.patch("/api/offers/:id", requireRole("restaurant", "admin"), async (req, res) => {
  const o = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { restaurant: true } });
  if (!o) return res.status(404).json({ code: "not_found" });
  if (req.user.role !== "admin" && o.restaurant.ownerUserId !== req.user.id)
    return res.status(403).json({ code: "forbidden" });

  const data = {};
  if (req.body.title) data.title = req.body.title;
  if (req.body.type) data.type = req.body.type;
  if (req.body.price) data.priceCents = Math.round(Number(req.body.price) * 100);
  if (req.body.originalPrice) data.originalPriceCents = Math.round(Number(req.body.originalPrice) * 100);
  if (req.body.qty != null) data.qty = Number(req.body.qty);
  if (req.body.pickupStart) data.pickupStart = req.body.pickupStart;
  if (req.body.pickupEnd) data.pickupEnd = req.body.pickupEnd;
  if (req.body.photoUrl !== undefined) data.photoUrl = req.body.photoUrl || null;

  const updated = await prisma.offer.update({ where: { id: o.id }, data });
  res.json(mapOffer(updated));
});
app.delete("/api/offers/:id", requireRole("restaurant", "admin"), async (req, res) => {
  const o = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { restaurant: true } });
  if (!o) return res.status(404).json({ code: "not_found" });
  if (req.user.role !== "admin" && o.restaurant.ownerUserId !== req.user.id)
    return res.status(403).json({ code: "forbidden" });

  await prisma.offer.delete({ where: { id: o.id } });
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`[catalog] listening on ${PORT}`));
