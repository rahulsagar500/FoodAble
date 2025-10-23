// src/api/restaurants.js
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const _restaurants = [
  {
    id: "r1",
    name: "Tokyo Bites",
    area: "Woolloongabba",
    heroUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r2",
    name: "Crust & Crumb",
    area: "West End",
    heroUrl:
      "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r3",
    name: "Nonna’s",
    area: "Fortitude Valley",
    heroUrl:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=1600&auto=format&fit=crop",
  },
];

export async function listRestaurants() {
  await delay(150);
  return _restaurants.map((r) => ({ ...r }));
}

export async function getRestaurant(id) {
  await delay(100);
  const r = _restaurants.find((x) => x.id === String(id));
  if (!r) throw new Error("Restaurant not found");
  return { ...r };
}
