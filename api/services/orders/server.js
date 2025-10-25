import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

const PORT = 4003;
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
function requireUser(req, res, next) {
  if (!req.auth?.uid) return res.status(401).json({ code: "unauthenticated" });
  next();
}
app.use(parseUser);

app.get("/healthz", (_r, s) => s.send("ok"));

app.post("/api/offers/:id/reserve", requireUser, async (req, res) => {
  const offerId = req.params.id;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const dec = await tx.offer.updateMany({
        where: { id: offerId, qty: { gt: 0 } },
        data: { qty: { decrement: 1 } }
      });
      if (dec.count === 0) {
        const exists = await tx.offer.findUnique({ where: { id: offerId }, select: { id: true } });
        const status = exists ? 409 : 404;
        const code = exists ? "sold_out" : "not_found";
        const err = new Error(exists ? "Offer is sold out" : "Offer not found");
        err.status = status; err.code = code;
        throw err;
      }
      const created = await tx.order.create({ data: { offerId }, select: { id: true } });
      return created;
    });
    res.json({ ok: true, orderId: order.id });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, code: e.code || "reserve_failed", message: e.message || "Failed to reserve" });
  }
});

app.post("/api/cart/checkout", requireUser, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ ok: false, code: "bad_request", message: "items[] required" });

  const merged = new Map();
  for (const it of items) {
    if (!it?.offerId) continue;
    merged.set(it.offerId, (merged.get(it.offerId) || 0) + Math.max(1, Number(it.qty || 1)));
  }

  try {
    const ids = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const [offerId, need] of merged) {
        for (let i = 0; i < need; i++) {
          const dec = await tx.offer.updateMany({ where: { id: offerId, qty: { gt: 0 } }, data: { qty: { decrement: 1 } } });
          if (dec.count === 0) {
            const exists = await tx.offer.findUnique({ where: { id: offerId }, select: { id: true } });
            const err = new Error(exists ? "Offer does not have enough quantity" : "Offer not found");
            err.code = exists ? "insufficient_qty" : "not_found";
            err.status = exists ? 409 : 404;
            throw err;
          }
          const order = await tx.order.create({ data: { offerId }, select: { id: true } });
          created.push(order.id);
        }
      }
      return created;
    });
    res.json({ ok: true, orderIds: ids });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, code: e.code || "checkout_failed", message: e.message || "Checkout failed" });
  }
});

app.listen(PORT, () => console.log(`[orders] listening on ${PORT}`));
