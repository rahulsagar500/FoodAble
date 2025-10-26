import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

const PORT = 4001;
const JWT_SECRET = process.env.JWT_SECRET || "dev";
const COOKIE_NAME = process.env.COOKIE_NAME || "token";
const COOKIE_DAYS = Number(process.env.COOKIE_DAYS || 7);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// --- Google OAuth env ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback";

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [FRONTEND_ORIGIN, "http://localhost:5174"],
    credentials: true,
  })
);

// ======================
// JWT helpers
// ======================
const signToken = (user) =>
  jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: `${COOKIE_DAYS}d`,
  });

const setAuthCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_DAYS * 86400000,
  });

function parseUser(req, _res, next) {
  const tok = req.cookies?.[COOKIE_NAME];
  if (tok) {
    try {
      req.auth = jwt.verify(tok, JWT_SECRET);
    } catch {}
  }
  next();
}
app.use(parseUser);

// ======================
// Google OAuth (Passport)
// ======================
app.use(passport.initialize());

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email =
            profile.emails && profile.emails[0] && profile.emails[0].value
              ? profile.emails[0].value.toLowerCase()
              : null;
          if (!email) return done(new Error("no_email_from_google"));

          const avatar = profile.photos?.[0]?.value || null;
          const name =
            profile.displayName ||
            [profile.name?.givenName, profile.name?.familyName]
              .filter(Boolean)
              .join(" ") ||
            null;

          // Find by googleId or email
          let user = await prisma.user.findFirst({
            where: { OR: [{ googleId: profile.id }, { email }] },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                googleId: profile.id,
                name,
                avatarUrl: avatar,
                role: "customer", // default role
              },
            });
          } else if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                avatarUrl: user.avatarUrl || avatar,
                name: user.name || name,
              },
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Kick off Google login
  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      session: false,
    })
  );

  // OAuth callback
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${FRONTEND_ORIGIN}/signin?error=oauth_failed`,
    }),
    async (req, res) => {
      // req.user is the Prisma user we returned from the strategy
      const user = req.user;
      const token = signToken(user);
      setAuthCookie(res, token);

      // Optionally send the user back to where they came from
      const redirectTo = `${FRONTEND_ORIGIN}/?login=success`;
      return res.redirect(redirectTo);
    }
  );
} else {
  // If Google keys aren’t present, expose a helpful message
  app.get("/api/auth/google", (_req, res) =>
    res.status(503).json({ ok: false, code: "google_oauth_disabled" })
  );
  app.get("/api/auth/google/callback", (_req, res) =>
    res.status(503).json({ ok: false, code: "google_oauth_disabled" })
  );
}

// ======================
// Health & session
// ======================
app.get("/healthz", (_r, s) => s.send("ok"));

app.get("/api/auth/me", async (req, res) => {
  if (!req.auth?.uid) return res.json(null);
  const user = await prisma.user.findUnique({
    where: { id: req.auth.uid },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true },
  });
  res.json(user);
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// ======================
// Email/password flows
// ======================
app.post("/api/auth/customer/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ code: "validation_error" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ code: "email_in_use" });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name,
        role: "customer",
      },
    });
    setAuthCookie(res, signToken(user));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post("/api/auth/customer/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    )
      return res.status(401).json({ code: "invalid_credentials" });
    setAuthCookie(res, signToken(user));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Owner flows
app.post("/api/auth/owner/register", async (req, res) => {
  try {
    const { email, password, name, restaurant } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ code: "validation_error" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ code: "email_in_use" });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name,
        role: "restaurant",
      },
    });

    if (restaurant?.name && restaurant?.heroUrl) {
      await prisma.restaurant.create({
        data: {
          name: restaurant.name,
          area: restaurant.area || null,
          heroUrl: restaurant.heroUrl,
          ownerUserId: user.id,
        },
      });
    }

    setAuthCookie(res, signToken(user));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post("/api/auth/owner/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    )
      return res.status(401).json({ code: "invalid_credentials" });

    if (user.role !== "restaurant") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "restaurant" },
      });
    }
    setAuthCookie(res, signToken({ ...user, role: "restaurant" }));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.listen(PORT, () => console.log(`[auth] listening on ${PORT}`));
