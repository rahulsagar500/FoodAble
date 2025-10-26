// api/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// ----- Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", FRONTEND_ORIGIN],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ----- Helpers
const COOKIE_NAME = "token";
const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", path: "/" };

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

function mapOffer(o) {
  return {
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
  };
}

// Read/verify JWT from cookie
function getSessionUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET); // { uid, email, role, ... }
  } catch {
    return null;
  }
}

// Middleware: requireRole for user-based auth
function requireRole(...roles) {
  return async (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
      const data = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: data.uid } });
      if (!user) return res.status(401).json({ error: "unauthorized" });
      if (!roles.includes(user.role)) return res.status(403).json({ error: "forbidden" });
      req.user = {
        id: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl,
      };
      next();
    } catch {
      return res.status(401).json({ error: "unauthorized" });
    }
  };
}

// Middleware: must NOT be logged in (prevents signing in twice)
function requireAnonymous(req, res, next) {
  const ses = getSessionUser(req);
  if (ses) return res.status(409).json({ error: "already_authenticated" });
  next();
}

// ----- Google OAuth (defaults to customer)
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (_at, _rt, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("Google account has no email."));
        const avatarUrl = profile.photos?.[0]?.value || null;
        const name = profile.displayName || null;
        const googleId = profile.id;

        let user = await prisma.user.findUnique({ where: { googleId } });
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { email, name: name ?? user.name, avatarUrl },
          });
          return done(null, { id: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
        }

        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          const updated = await prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId, name: byEmail.name ?? name, avatarUrl: byEmail.avatarUrl ?? avatarUrl },
          });
          return done(null, { id: updated.id, email: updated.email, role: updated.role, name: updated.name, avatarUrl: updated.avatarUrl });
        }

        const created = await prisma.user.create({
          data: { email, googleId, name, avatarUrl, role: "customer" },
        });

        return done(null, { id: created.id, email: created.email, role: created.role, name: created.name, avatarUrl: created.avatarUrl });
      } catch (e) {
        if (e?.code === "P2002" && Array.isArray(e.meta?.target) && e.meta.target.includes("email")) {
          try {
            const email = profile.emails?.[0]?.value;
            const fallback = await prisma.user.findUnique({ where: { email } });
            if (fallback) {
              const linked = await prisma.user.update({
                where: { id: fallback.id },
                data: { googleId: profile.id },
              });
              return done(null, { id: linked.id, email: linked.email, role: linked.role, name: linked.name, avatarUrl: linked.avatarUrl });
            }
          } catch (e2) { return done(e2); }
        }
        return done(e);
      }
    }
  )
);

// ----- Health
app.get("/api/health", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); }
  catch { res.status(500).json({ ok: false, error: "db_unavailable" }); }
});

// ----- Google OAuth routes
app.get(
  "/api/auth/google",
  (req, res, next) => {
    const ses = getSessionUser(req);
    if (ses) return res.redirect(FRONTEND_ORIGIN);
    next();
  },
  passport.authenticate("google", { scope: ["openid", "email", "profile"], prompt: "select_account" })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_ORIGIN}/signin?error=google_failed` }),
  async (req, res) => {
    const token = signToken({ uid: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name, avatarUrl: req.user.avatarUrl });
    res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect(FRONTEND_ORIGIN);
  }
);

// ===================================================================================
// AUTH: Owner / Customer using a SINGLE User table
// ===================================================================================

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: "validation_error", details: errors.array() }); return false; }
  return true;
}

// OWNER REGISTER (also creates initial Restaurant)
app.post(
  "/api/auth/owner/register",
  requireAnonymous,
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("name").isString().isLength({ min: 1 }).trim(),
  // optional restaurant fields:
  body("restaurantName").optional().isString().trim(),
  body("area").optional().isString().trim(),
  body("heroUrl").optional().isString().trim(),
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    const { email, password, name, restaurantName, area, heroUrl } = req.body;
    try {
      let user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        if (user.passwordHash) return res.status(409).json({ error: "email_in_use" });
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(password, 10),
            name: user.name || name,
            role: user.role === "admin" || user.role === "restaurant" ? user.role : "restaurant",
          },
        });
      } else {
        user = await prisma.user.create({
          data: { email, name, role: "restaurant", passwordHash: await bcrypt.hash(password, 10) },
        });
      }

      // Create restaurant if provided (or if none exists yet but we have minimal fields)
      let restaurant = await prisma.restaurant.findFirst({ where: { ownerUserId: user.id } });
      if (!restaurant && (restaurantName || heroUrl)) {
        restaurant = await prisma.restaurant.create({
          data: {
            name: restaurantName || `${name}'s Restaurant`,
            area: area || null,
            heroUrl: heroUrl || "https://picsum.photos/1200/400",
            ownerUserId: user.id,
          },
        });
      }

      const token = signToken({ uid: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
      res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

      res.status(201).json({
        success: true,
        user: { id: user.id, email: user.email, role: user.role, name: user.name },
        restaurant,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "internal_error" });
    }
  }
);

// OWNER LOGIN
app.post(
  "/api/auth/owner/login",
  requireAnonymous,
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 6 }),
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    const { email, password } = req.body;
    try {
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid_credentials" });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "invalid_credentials" });

      if (user.role !== "restaurant" && user.role !== "admin") {
        user = await prisma.user.update({ where: { id: user.id }, data: { role: "restaurant" } });
      }

      const token = signToken({ uid: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
      res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
    } catch (e) { console.error(e); res.status(500).json({ error: "internal_error" }); }
  }
);

// CUSTOMER REGISTER
app.post(
  "/api/auth/customer/register",
  requireAnonymous,
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("name").isString().isLength({ min: 1 }).trim(),
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    const { email, password, name } = req.body;
    try {
      let user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        if (user.passwordHash) return res.status(409).json({ error: "email_in_use" });
        user = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: await bcrypt.hash(password, 10), name: user.name || name, role: user.role === "admin" || user.role === "customer" ? user.role : "customer" },
        });
      } else {
        user = await prisma.user.create({ data: { email, name, role: "customer", passwordHash: await bcrypt.hash(password, 10) } });
      }

      const token = signToken({ uid: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
      res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.status(201).json({ success: true, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    } catch (e) { console.error(e); res.status(500).json({ error: "internal_error" }); }
  }
);

// CUSTOMER LOGIN
app.post(
  "/api/auth/customer/login",
  requireAnonymous,
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 6 }),
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    const { email, password } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid_credentials" });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "invalid_credentials" });

      const token = signToken({ uid: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
      res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
    } catch (e) { console.error(e); res.status(500).json({ error: "internal_error" }); }
  }
);

// ----- Session helpers
app.get("/api/auth/me", async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.json(null);
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: data.uid } });
    if (!user) return res.json(null);
    res.json({ id: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl });
  } catch { res.json(null); }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ ok: true });
});

// ===================================================================================
// PUBLIC RESTAURANT / OFFER ROUTES
// ===================================================================================
app.get("/api/restaurants", async (_req, res, next) => {
  try {
    const rs = await prisma.restaurant.findMany({ orderBy: { name: "asc" } });
    res.json(rs);
  } catch (e) { next(e); }
});

app.get("/api/restaurants/:id", async (req, res, next) => {
  try {
    const r = await prisma.restaurant.findUnique({ where: { id: String(req.params.id) } });
    if (!r) return res.status(404).json({ error: "Restaurant not found" });
    res.json(r);
  } catch (e) { next(e); }
});

app.get("/api/restaurants/:id/offers", async (req, res, next) => {
  try {
    const os = await prisma.offer.findMany({
      where: { restaurantId: String(req.params.id) },
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(os.map(mapOffer));
  } catch (e) { next(e); }
});

app.get("/api/offers", async (_req, res, next) => {
  try {
    const os = await prisma.offer.findMany({ include: { restaurant: true }, orderBy: { createdAt: "desc" } });
    res.json(os.map(mapOffer));
  } catch (e) { next(e); }
});

app.get("/api/offers/:id", async (req, res, next) => {
  try {
    const o = await prisma.offer.findUnique({ where: { id: String(req.params.id) }, include: { restaurant: true } });
    if (!o) return res.status(404).json({ error: "Offer not found" });
    res.json(mapOffer(o));
  } catch (e) { next(e); }
});

// ===================================================================================
// OWNER PORTAL ROUTES (requires role restaurant or admin)
// ===================================================================================

// Get my restaurant
app.get("/api/me/restaurant", requireRole("restaurant", "admin"), async (req, res, next) => {
  try {
    const r = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
    res.json(r || null);
  } catch (e) { next(e); }
});

// Create/update my restaurant
app.post("/api/me/restaurant", requireRole("restaurant", "admin"), async (req, res, next) => {
  try {
    const { name, area, heroUrl } = req.body || {};
    if (!name || !heroUrl) return res.status(400).json({ error: "missing_fields" });

    const existing = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
    const r = existing
      ? await prisma.restaurant.update({ where: { id: existing.id }, data: { name, area, heroUrl } })
      : await prisma.restaurant.create({ data: { name, area, heroUrl, ownerUserId: req.user.id } });

    res.json(r);
  } catch (e) { next(e); }
});

// List my offers
app.get("/api/me/offers", requireRole("restaurant", "admin"), async (req, res, next) => {
  try {
    const myRestaurant = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
    if (!myRestaurant) return res.json([]);
    const os = await prisma.offer.findMany({ where: { restaurantId: myRestaurant.id }, include: { restaurant: true }, orderBy: { createdAt: "desc" } });
    res.json(os.map(mapOffer));
  } catch (e) { next(e); }
});

// Create an offer (for my restaurant; admin can override)
app.post("/api/offers", requireRole("restaurant", "admin"), async (req, res, next) => {
  try {
    let target = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
    if (!target) return res.status(400).json({ error: "no_restaurant_profile" });

    const {
      restaurantId, // optional override if admin
      title,
      type = "discount",
      price,
      originalPrice,
      qty = 0,
      pickupStart = "17:00",
      pickupEnd = "19:00",
      photoUrl,
    } = req.body || {};

    if (restaurantId && req.user.role === "admin") {
      const r2 = await prisma.restaurant.findUnique({ where: { id: String(restaurantId) } });
      if (!r2) return res.status(400).json({ error: "Invalid restaurantId" });
      target = r2;
    }

    const priceCents = Math.round(Number(price) * 100);
    const origCents = Math.round(Number(originalPrice) * 100);
    if (!Number.isFinite(priceCents) || !Number.isFinite(origCents)) {
      return res.status(400).json({ error: "Invalid prices" });
    }

    const created = await prisma.offer.create({
      data: {
        restaurantId: target.id,
        title: String(title || "").trim(),
        type,
        priceCents,
        originalPriceCents: origCents,
        distanceKm: 1.0,
        pickupStart,
        pickupEnd,
        qty: Math.max(0, parseInt(qty, 10) || 0),
        photoUrl: photoUrl || target.heroUrl,
      },
      include: { restaurant: true },
    });

    res.status(201).json(mapOffer(created));
  } catch (e) { next(e); }
});

// Update an offer (only owner/admin)
app.patch("/api/offers/:id", requireRole("restaurant", "admin"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const offer = await prisma.offer.findUnique({ where: { id }, include: { restaurant: true } });
    if (!offer) return res.status(404).json({ error: "not_found" });

    if (req.user.role !== "admin") {
      const myRestaurant = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
      if (!myRestaurant || offer.restaurantId !== myRestaurant.id) return res.status(403).json({ error: "forbidden" });
    }

    const patch = {};
    if (req.body.title != null) patch.title = String(req.body.title).trim();
    if (req.body.type != null) patch.type = req.body.type;
    if (req.body.price != null) patch.priceCents = Math.round(Number(req.body.price) * 100);
    if (req.body.originalPrice != null) patch.originalPriceCents = Math.round(Number(req.body.originalPrice) * 100);
    if (req.body.qty != null) patch.qty = Math.max(0, parseInt(req.body.qty, 10) || 0);
    if (req.body.pickupStart != null) patch.pickupStart = String(req.body.pickupStart);
    if (req.body.pickupEnd != null) patch.pickupEnd = String(req.body.pickupEnd);
    if (req.body.photoUrl != null) patch.photoUrl = String(req.body.photoUrl);

    const updated = await prisma.offer.update({ where: { id }, data: patch, include: { restaurant: true } });
    res.json(mapOffer(updated));
  } catch (e) { next(e); }
});

// Delete an offer (only owner/admin)
app.delete("/api/offers/:id", requireRole("restaurant", "admin"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const offer = await prisma.offer.findUnique({ where: { id }, include: { restaurant: true } });
    if (!offer) return res.status(404).json({ error: "not_found" });

    if (req.user.role !== "admin") {
      const myRestaurant = await prisma.restaurant.findFirst({ where: { ownerUserId: req.user.id } });
      if (!myRestaurant || offer.restaurantId !== myRestaurant.id) return res.status(403).json({ error: "forbidden" });
    }

    await prisma.offer.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ===== Orders / Checkout =====

// Reserve ONE unit of an offer, create an Order, and decrement qty atomically
app.post("/api/offers/:id/reserve", async (req, res) => {
  const offerId = req.params.id;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Decrement qty only if > 0
      const dec = await tx.offer.updateMany({
        where: { id: offerId, qty: { gt: 0 } },
        data: { qty: { decrement: 1 } },
      });
      if (dec.count === 0) {
        // Either offer not found or sold out
        const exists = await tx.offer.findUnique({ where: { id: offerId }, select: { id: true } });
        const code = exists ? "sold_out" : "not_found";
        const msg = exists ? "Offer is sold out" : "Offer not found";
        const status = exists ? 409 : 404;
        const err = new Error(msg);
        err.code = code;
        err.status = status;
        throw err;
      }

      // Create order
      const created = await tx.order.create({
        data: { offerId },
        select: { id: true },
      });

      return created;
    });

    return res.json({ ok: true, orderId: order.id });
  } catch (e) {
    const status = e.status || 500;
    const code = e.code || "reserve_failed";
    return res.status(status).json({ ok: false, code, message: e.message || "Failed to reserve offer" });
  }
});

// Reserve MANY in one go (cart checkout). Body: { items: [{ offerId, qty }] }
app.post("/api/cart/checkout", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ ok: false, code: "bad_request", message: "items[] required" });
  }

  // Normalise: merge same offerIds
  const merged = new Map();
  for (const it of items) {
    if (!it?.offerId) continue;
    const q = Math.max(1, Number(it.qty || 1) | 0);
    merged.set(it.offerId, (merged.get(it.offerId) || 0) + q);
  }

  try {
    const orderIds = await prisma.$transaction(async (tx) => {
      const createdIds = [];

      for (const [offerId, need] of merged) {
        // Attempt 'need' decrements, one-by-one to honour qty>0 guard
        for (let i = 0; i < need; i++) {
          const dec = await tx.offer.updateMany({
            where: { id: offerId, qty: { gt: 0 } },
            data: { qty: { decrement: 1 } },
          });
          if (dec.count === 0) {
            const exists = await tx.offer.findUnique({ where: { id: offerId }, select: { id: true, qty: true } });
            const err = new Error(exists ? "Offer does not have enough quantity" : "Offer not found");
            err.code = exists ? "insufficient_qty" : "not_found";
            err.status = exists ? 409 : 404;
            throw err;
          }

          const order = await tx.order.create({
            data: { offerId },
            select: { id: true },
          });
          createdIds.push(order.id);
        }
      }

      return createdIds;
    });

    return res.json({ ok: true, orderIds });
  } catch (e) {
    const status = e.status || 500;
    const code = e.code || "checkout_failed";
    return res.status(status).json({ ok: false, code, message: e.message || "Checkout failed; nothing was reserved" });
  }
});


// ----- Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
