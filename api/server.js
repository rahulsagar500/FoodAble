// server.js (DB + Google OAuth + JWT cookie)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");

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
app.use(passport.initialize());

// ---------- Auth helpers ----------
const COOKIE_NAME = "token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  // secure: true, // enable when using https
  path: "/",
};

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

// ---------- Passport (Google) ----------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatarUrl = profile.photos?.[0]?.value;
        const name = profile.displayName;

        // upsert user
        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: { email, name, avatarUrl },
          create: {
            googleId: profile.id,
            email,
            name,
            avatarUrl,
            role: "customer",
          },
        });
        done(null, { id: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
      } catch (e) {
        done(e);
      }
    }
  )
);

// ---------- Health ----------
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "db_unavailable" });
  }
});

// ---------- Auth routes ----------
app.get("/api/auth/google", passport.authenticate("google", { scope: ["openid", "email", "profile"] }));

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "http://localhost:5173" }),
  async (req, res) => {
    // req.user was set in the strategy's done()
    const token = signToken({
      uid: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
    });
    res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect("http://localhost:5173"); // back to app
  }
);

app.get("/api/auth/me", async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.json(null);
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    // fetch fresh role/name in case they changed
    const user = await prisma.user.findUnique({ where: { id: data.uid } });
    if (!user) return res.json(null);
    res.json({ id: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
  } catch {
    res.json(null);
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ ok: true });
});

// ---------- Helpers to map DB offers to API shape ----------
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

// ---------- Restaurants ----------
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

// ---------- Offers ----------
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

app.post("/api/offers", requireAuth, async (req, res, next) => {
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

// ---------- Errors ----------
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
