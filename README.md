FoodAble — Run Guide
====================

This repo contains a React web frontend (`web/`) and a microservice backend (`api/`) deployed behind an Nginx gateway. You can run it with Docker Compose (local) or Kubernetes (Docker Desktop or minikube).

Prerequisites
-------------
- Node.js 18+ and npm
- Docker Desktop (recommended), or minikube
- kubectl (for Kubernetes runs)

Quick Start (Docker Compose)
---------------------------
The Compose stack runs Postgres, the three services (auth, catalog, orders), and the gateway.

1) Configure env (already provided):
- `api/.env.compose` contains `DATABASE_URL`, `JWT_SECRET`, Google OAuth keys and `FRONTEND_ORIGIN`.

2) Start backend:
- `cd api`
- `docker compose up -d`
- Gateway: http://localhost:4000
- Adminer (DB UI): http://localhost:8087  (server: host.docker.internal, port: 5435)

3) Start frontend:
- `cd web`
- `npm install`
- `npm run dev` → http://localhost:5173 (Vite proxy forwards `/api` → gateway)

4) Google Sign‑In (optional):
- Ensure `GOOGLE_CLIENT_ID/SECRET` and `GOOGLE_CALLBACK_URL` in `api/.env.compose`.
- Google Console must have Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`.

Kubernetes (Docker Desktop)
---------------------------
This path builds local images and deploys the full stack into the built‑in Kubernetes cluster.

1) (Optional) Provide real secrets:
- Create `k8s/secret.local.yaml` (git‑ignored) or rely on `api/.env.compose` values.

2) Deploy everything:
- From repo root: `./deploy.sh`
- This will: build images, apply manifests (namespace/config/secrets), run Prisma migrations, roll out services, and smoke‑test core endpoints.

3) Launch frontend:
- `cd web && npm install && npm run dev`
- Visit http://localhost:5173

4) Verify OAuth:
- `curl -i http://localhost:4000/api/auth/google` → 302 to accounts.google.com

Kubernetes (minikube)
---------------------
1) Start cluster and point Docker builds at minikube:
- `minikube start`
- `./deploy.sh --minikube`  (uses Ingress + `foodable.local`)

2) Map host for Ingress:
- `minikube ip` → add to hosts file as `foodable.local`

3) Frontend:
- `cd web && npm install && npm run dev` (proxy to `http://foodable.local` if you set Vite proxy accordingly; default proxy targets `http://localhost:4000`. You can keep a port‑forward instead: `kubectl -n foodable port-forward svc/gateway 4000:4000`.)

Scaling & Load Balancing Demo
-----------------------------
- Scale catalog to 3 pods: `kubectl -n foodable scale deploy/catalog --replicas=3`
- Run LB smoke test (shows `X-Service` and `X-Instance` headers):
  - `node scripts/smoke-api.js`  (defaults to http://localhost:4000)

Smoke Tests (CLI)
-----------------
- API quick check: `node scripts/smoke-api.js --base http://localhost:4000`
- Frontend smoke: visit http://localhost:5173, sign in (Google or email), browse offers, add to cart, checkout.

Troubleshooting
---------------
- kubectl points to `http://localhost:8080`: Kubernetes not running. Enable Docker Desktop Kubernetes or `minikube start`.
- Google OAuth 503 `google_oauth_disabled`: Missing credentials in Secret. Update `k8s/secret.local.yaml` or rerun `./deploy.sh` (reads `api/.env.compose`). Ensure redirect URI matches your entry (localhost:4000 or foodable.local).
- DB connection errors: use local DB `DATABASE_URL=postgresql://postgres:Meena%23123@host.docker.internal:5435/foodable?schema=public`, or `--inclusterdb` to deploy Postgres in cluster.

Clean Up
--------
- Docker Compose: `cd api && docker compose down`
- Kubernetes: `kubectl delete namespace foodable`

Project Structure
-----------------
- `web/` — React app (Vite, Bootstrap, Axios). See `web/README.md`.
- `api/` — Microservices (auth, catalog, orders), Prisma schema, gateway. See `api/README.md`.
- `k8s/` — Kubernetes manifests and `k8s/README.md` for details.
- `deploy.sh` — One‑shot build + deploy + migrate + smoke test for Kubernetes.
- `scripts/` — Helpers: `smoke-api.js`, `fix-mojibake.js`.

