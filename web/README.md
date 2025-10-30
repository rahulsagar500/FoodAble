FoodAble Web
============

React + Vite single‑page app with Bootstrap styling. Proxies `/api` to the backend gateway on `http://localhost:4000` in dev.

Structure
---------
- src/pages: Restaurants, RestaurantDetails, OfferDetails, cart, SignIn, SignUp, Owner* pages
- src/components: NavBar, Layout, AnonymousRoute, LoginPrompt
- src/api: axios helpers for restaurants/offers
- src/lib: api client, auth/session helpers, formatting utilities, useMe hook
- src/cart: CartContext with localStorage persistence

Dev
---
cd web
npm install
npm run dev

Config
------
- Vite dev proxy (`web/vite.config.js`) forwards `/api` → `http://localhost:4000`
- Axios client (`src/lib/api.js`) uses base `/api` and `withCredentials: true` so the backend’s HTTP‑only cookie is sent.

User Flows
----------
- Browse restaurants and offers, search/filter
- View offer details; add to cart; reserve (requires login)
- Customer auth: Google or email/password
- Owner portal: create/update restaurant; create/update/delete offers

Notes
-----
- Backend routes are documented in `api/README.md` and served via the Nginx gateway.
- The UI depends on the `/api/auth/me` session endpoint and JWT cookie set by the auth service.

