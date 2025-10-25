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

// ----- Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
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

// Middleware: requireRole for user-based auth
function requireRole(...roles) {
  return async (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
      const data = jwt.verify(token, process.env.JWT_SECRET);

      // data.uid is the User.id, based on our signToken below
      const user = await prisma.user.findUnique({
        where: { id: data.uid },
      });
      if (!user) return res.status(401).json({ error: "unauthorized" });

      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "forbidden" });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
      next();
    } catch {
      return res.status(401).json({ error: "unauthorized" });
    }
  };
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

        // 1) If we already have a user with this googleId, update basic fields and return.
        let user = await prisma.user.findUnique({ where: { googleId } });
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { email, name: name ?? user.name, avatarUrl },
          });
          return done(null, {
            id: user.id, email: user.email, role: user.role, name: user.name, avatarUrl: user.avatarUrl,
          });
        }

        // 2) No googleId match — maybe the user previously signed up with the same email.
        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          // Attach googleId to the existing account (keeps their role/password if any)
          const updated = await prisma.user.update({
            where: { id: byEmail.id },
            data: {
              googleId,
              // only fill blanks; don't stomp existing profile fields
              name: byEmail.name ?? name,
              avatarUrl: byEmail.avatarUrl ?? avatarUrl,
              // role stays as-is (customer/restaurant/admin). If you always want customer, remove this line.
            },
          });
          return done(null, {
            id: updated.id, email: updated.email, role: updated.role, name: updated.name, avatarUrl: updated.avatarUrl,
          });
        }

        // 3) Brand-new Google user → create as customer by default.
        const created = await prisma.user.create({
          data: { email, googleId, name, avatarUrl, role: "customer" },
        });

        return done(null, {
          id: created.id, email: created.email, role: created.role, name: created.name, avatarUrl: created.avatarUrl,
        });
      } catch (e) {
        // If we somehow race and still hit a unique collision, try the email-link path once more.
        if (e?.code === "P2002" && Array.isArray(e.meta?.target) && e.meta.target.includes("email")) {
          try {
            const fallback = await prisma.user.findUnique({ where: { email: profile.emails?.[0]?.value } });
            if (fallback) {
              const linked = await prisma.user.update({
                where: { id: fallback.id },
                data: { googleId: profile.id },
              });
              return done(null, {
                id: linked.id, email: linked.email, role: linked.role, name: linked.name, avatarUrl: linked.avatarUrl,
              });
            }
          } catch (e2) {
            return done(e2);
          }
        }
        return done(e);
      }
    }
  )
);


// ----- Health
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "db_unavailable" });
  }
});

// ----- Google OAuth routes
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["openid", "email", "profile"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:5173",
  }),
  async (req, res) => {
    const token = signToken({
      uid: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
    });

    res.cookie(COOKIE_NAME, token, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("http://localhost:5173");
  }
);

// ===================================================================================
// AUTH: Owner / Customer using a SINGLE User table
// ===================================================================================

// Helper for validation errors
function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res
      .status(400)
      .json({ error: "validation_error", details: errors.array() });
    return false;
  }
  return true;
}

// OWNER REGISTER
app.post(
  "/api/auth/owner/register",
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("name").isString().isLength({ min: 1 }).trim(),
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    const { email, password, name } = req.body;
    try {
      let user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        // If user exists and already has a password, it's in use
        if (user.passwordHash) {
          return res.status(409).json({ error: "email_in_use" });
        }

        // Else attach passwordHash and upgrade role if needed
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(password, 10),
            name: user.name || name,
            role:
              user.role === "admin" || user.role === "restaurant"
                ? user.role
                : "restaurant",
          },
        });
      } else {
        // brand new restaurant owner
        user = await prisma.user.create({
          data: {
            email,
            name,
            role: "restaurant",
            passwordHash: await bcrypt.hash(password, 10),
          },
        });
      }

      // set cookie
      const token = signToken({
        uid: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      res.cookie(COOKIE_NAME, token, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
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
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 6 }),
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    const { email, password } = req.body;
    try {
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "invalid_credentials" });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "invalid_credentials" });
      }

      // Make sure they are at least restaurant
      if (user.role !== "restaurant" && user.role !== "admin") {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: "restaurant" },
        });
      }

      const token = signToken({
        uid: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      res.cookie(COOKIE_NAME, token, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "internal_error" });
    }
  }
);

// CUSTOMER REGISTER
app.post(
  "/api/auth/customer/register",
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("name").isString().isLength({ min: 1 }).trim(),
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    const { email, password, name } = req.body;
    try {
      let user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        if (user.passwordHash) {
          return res.status(409).json({ error: "email_in_use" });
        }

        // attach passwordHash; set role to customer unless they're already admin
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(password, 10),
            name: user.name || name,
            role:
              user.role === "admin" || user.role === "customer"
                ? user.role
                : "customer",
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name,
            role: "customer",
            passwordHash: await bcrypt.hash(password, 10),
          },
        });
      }

      const token = signToken({
        uid: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      res.cookie(COOKIE_NAME, token, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "internal_error" });
    }
  }
);

// CUSTOMER LOGIN
app.post(
  "/api/auth/customer/login",
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 6 }),
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    const { email, password } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "invalid_credentials" });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "invalid_credentials" });
      }

      const token = signToken({
        uid: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      res.cookie(COOKIE_NAME, token, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "internal_error" });
    }
  }
);

// ----- Session helpers
app.get("/api/auth/me", async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.json(null);
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: data.uid },
    });
    if (!user) return res.json(null);

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  } catch {
    res.json(null);
  }
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
    const rs = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
    });
    res.json(rs);
  } catch (e) {
    next(e);
  }
});

app.get("/api/restaurants/:id", async (req, res, next) => {
  try {
    const r = await prisma.restaurant.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!r) return res.status(404).json({ error: "Restaurant not found" });
    res.json(r);
  } catch (e) {
    next(e);
  }
});

app.get("/api/restaurants/:id/offers", async (req, res, next) => {
  try {
    const os = await prisma.offer.findMany({
      where: { restaurantId: String(req.params.id) },
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(os.map(mapOffer));
  } catch (e) {
    next(e);
  }
});

app.get("/api/offers", async (_req, res, next) => {
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

// ===================================================================================
// OWNER PORTAL ROUTES (requires role restaurant or admin)
// ===================================================================================

// Get or upsert the owner's Restaurant
// Behavior:
// - GET: returns the current user's restaurant (or null if they haven't made one yet)
// - POST: create or update the restaurant for this user
app.get(
  "/api/me/restaurant",
  requireRole("restaurant", "admin"),
  async (req, res, next) => {
    try {
      const r = await prisma.restaurant.findFirst({
        where: { ownerUserId: req.user.id },
      });
      res.json(r || null);
    } catch (e) {
      next(e);
    }
  }
);

app.post(
  "/api/me/restaurant",
  requireRole("restaurant", "admin"),
  async (req, res, next) => {
    try {
      const { name, area, heroUrl } = req.body || {};
      if (!name || !heroUrl) {
        return res.status(400).json({ error: "missing_fields" });
      }

      const existing = await prisma.restaurant.findFirst({
        where: { ownerUserId: req.user.id },
      });

      const r = existing
        ? await prisma.restaurant.update({
            where: { id: existing.id },
            data: { name, area, heroUrl },
          })
        : await prisma.restaurant.create({
            data: {
              name,
              area,
              heroUrl,
              ownerUserId: req.user.id,
            },
          });

      res.json(r);
    } catch (e) {
      next(e);
    }
  }
);

// Create an offer for the restaurant owned by the logged-in user
app.post(
  "/api/offers",
  requireRole("restaurant", "admin"),
  async (req, res, next) => {
    try {
      // find this user's restaurant
      let target = await prisma.restaurant.findFirst({
        where: { ownerUserId: req.user.id },
      });
      if (!target) {
        return res.status(400).json({ error: "no_restaurant_profile" });
      }

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
        // allow admins to post offers for any restaurantId
        const r2 = await prisma.restaurant.findUnique({
          where: { id: String(restaurantId) },
        });
        if (!r2) {
          return res.status(400).json({ error: "Invalid restaurantId" });
        }
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
    } catch (e) {
      next(e);
    }
  }
);

// Reserve an offer (customer must be logged in as customer or admin)
app.post(
  "/api/offers/:id/reserve",
  requireRole("customer", "admin"),
  async (req, res, next) => {
    const id = String(req.params.id);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const offer = await tx.offer.findUnique({ where: { id } });
        if (!offer)
          return { status: 404, error: "Offer not found" };
        if (offer.qty <= 0)
          return { status: 409, error: "Sold out" };

        await tx.offer.update({
          where: { id },
          data: { qty: { decrement: 1 } },
        });

        const order = await tx.order.create({
          data: { offerId: id, status: "reserved" },
        });

        return { status: 200, order };
      });

      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }

      res.json({ orderId: result.order.id, offerId: id });
    } catch (e) {
      next(e);
    }
  }
);

// ----- Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
