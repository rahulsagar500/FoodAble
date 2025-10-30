FoodAble API
============

Microservice backend with three services (auth, catalog, orders) fronted by an Nginx gateway. Uses PostgreSQL + Prisma. Deploy via Docker Compose (local) or Kubernetes (k8s/ + deploy.sh).

Services
--------
- auth: Google/email auth, JWT cookie, /api/auth/*
- catalog: public browse + owner CRUD, /api/restaurants, /api/offers, /api/me/*
- orders: reserve one, cart checkout (transactional), /api/offers/:id/reserve, /api/cart/checkout
- gateway: path router (not per‑pod LB) mapping /api/* to services

Data Model
----------
- User, Restaurant, Offer, Order (see prisma/schema.prisma). Orders and reserve use transactions with a guarded decrement (qty > 0).

Run (Compose)
-------------
cd api
docker compose up -d
Gateway: http://localhost:4000  •  Adminer: http://localhost:8087

Run (Kubernetes)
----------------
./deploy.sh            # Docker Desktop
./deploy.sh --minikube # minikube + Ingress

Environment
-----------
DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL, FRONTEND_ORIGIN (see api/.env.compose or k8s/secret.local.yaml).

