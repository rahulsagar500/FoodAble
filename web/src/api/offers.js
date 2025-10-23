// src/api/offers.js
import { api } from "../lib/api";

// GET /api/offers
export async function listOffers() {
  const { data } = await api.get("/offers");
  return data;
}

// GET /api/restaurants/:id/offers
export async function listOffersByRestaurant(restaurantId) {
  const { data } = await api.get(`/restaurants/${restaurantId}/offers`);
  return data;
}

// GET /api/offers/:id
export async function getOffer(id) {
  const { data } = await api.get(`/offers/${id}`);
  return data;
}

// POST /api/offers/:id/reserve
export async function reserveOffer(id) {
  const { data } = await api.post(`/offers/${id}/reserve`);
  return data; // { orderId, offerId }
}

// POST /api/offers
// payload = { restaurantId, title, type, price, originalPrice, qty, pickupStart, pickupEnd, photoUrl? }
export async function createOffer(payload) {
  const { data } = await api.post("/offers", payload);
  return data;
}

export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
