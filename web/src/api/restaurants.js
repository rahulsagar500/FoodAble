// src/api/restaurants.js
import { api } from "../lib/api";

// GET /api/restaurants
export async function listRestaurants() {
  const { data } = await api.get("/restaurants");
  return data;
}

// GET /api/restaurants/:id
export async function getRestaurant(id) {
  const { data } = await api.get(`/restaurants/${id}`);
  return data;
}
