// src/api/offers.js
import { api } from "../lib/api";

/**
 * GET /api/offers
 */
export async function listOffers() {
  const { data } = await api.get("/offers");
  return data;
}

/**
 * GET /api/restaurants/:id/offers
 */
export async function listOffersByRestaurant(restaurantId) {
  const { data } = await api.get(`/restaurants/${restaurantId}/offers`);
  return data;
}

/**
 * GET /api/offers/:id
 */
export async function getOffer(id) {
  const { data } = await api.get(`/offers/${id}`);
  return data;
}

/**
 * POST /api/offers/:id/reserve
 * Reserves exactly 1 unit of the offer.
 * Returns: { ok: true, orderId }
 */
export async function reserveOffer(id) {
  const { data } = await api.post(`/offers/${id}/reserve`);
  return data; // { ok, orderId }
}

/**
 * POST /api/cart/checkout
 * Bulk checkout in a single transaction.
 * items = [{ offerId, qty }]
 * Returns: { ok: true, orderIds: [] }
 */
export async function checkoutCart(items) {
  const { data } = await api.post("/cart/checkout", { items });
  return data; // { ok, orderIds }
}

/**
 * POST /api/offers
 * payload = { restaurantId, title, type, price, originalPrice, qty, pickupStart, pickupEnd, photoUrl? }
 */
export async function createOffer(payload) {
  const { data } = await api.post("/offers", payload);
  return data;
}

/**
 * Convenience formatter (you also have src/lib/format.js if you prefer).
 */
export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
