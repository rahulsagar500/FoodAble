Foodable on Kubernetes
======================

This folder contains a minimal k8s setup for the microservice backend (auth, catalog, orders) fronted by an Nginx gateway, plus Postgres and optional Adminer.

Contents
--------
- `namespace.yaml` — Namespace `foodable`
- `configmap.yaml` — Non‑secret app config (CORS, cookie)
- `secret.template.yaml` — Secrets template (JWT, DATABASE_URL, optional Google OAuth)
- `postgres.yaml` — Postgres Service + StatefulSet (1Gi PVC)
- `adminer.yaml` — Adminer UI (ClusterIP on 8080)
- `migrate-job.yaml` — Runs `prisma migrate deploy`
- `auth.yaml`, `catalog.yaml`, `orders.yaml` — Deployments + Services
- `gateway.yaml` — Nginx config + Deployment + LoadBalancer Service on port 4000

Images
------
These manifests use local image names (no registry):
- `foodable-auth:latest`
- `foodable-catalog:latest`
- `foodable-orders:latest`

Build into your cluster’s container runtime:

- Docker Desktop Kubernetes (recommended): builds are immediately visible to the cluster.

```bash
cd api
docker build -f services/auth/Dockerfile     -t foodable-auth:latest .
docker build -f services/catalog/Dockerfile  -t foodable-catalog:latest .
docker build -f services/orders/Dockerfile   -t foodable-orders:latest .
```

- Minikube: build into minikube’s Docker daemon.

```bash
eval $(minikube docker-env)
cd api
docker build -f services/auth/Dockerfile     -t foodable-auth:latest .
docker build -f services/catalog/Dockerfile  -t foodable-catalog:latest .
docker build -f services/orders/Dockerfile   -t foodable-orders:latest .
```

Configure Secrets
------------------
Copy the secrets template and fill real values (do not commit secrets):

```bash
kubectl apply -f k8s/namespace.yaml
cp k8s/secret.template.yaml k8s/secret.yaml
# Edit k8s/secret.yaml — set JWT_SECRET and DATABASE_URL, and optional Google keys
kubectl apply -f k8s/secret.yaml
```

Database URL options:
- In‑cluster Postgres (default in template): `postgresql://foodable:foodable@postgres:5432/foodable?schema=public`
- Your local DB (as you noted): `postgresql://postgres:Meena%23123@host.docker.internal:5435/foodable?schema=public`
  - Note: `%23` is the URL-encoding for `#`
  - On minikube, use `host.minikube.internal` instead of `host.docker.internal`.

Deploy Order
-----------
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml                # created from template

# If using in-cluster Postgres
kubectl apply -f k8s/postgres.yaml
# Optional Adminer
kubectl apply -f k8s/adminer.yaml

# Run Prisma migrations once (uses catalog image)
kubectl apply -f k8s/migrate-job.yaml

# Deploy services
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/catalog.yaml
kubectl apply -f k8s/orders.yaml
kubectl apply -f k8s/gateway.yaml
```

Access
------
- Gateway via LoadBalancer (Docker Desktop): port 4000 on localhost.
- Gateway via Ingress (minikube/kind): enable NGINX ingress and apply `k8s/ingress.yaml`.
  - Minikube: `minikube addons enable ingress`
  - Get minikube IP and add hosts entry for `foodable.local` → that IP.
- Adminer (optional): port-forward `kubectl -n foodable port-forward svc/adminer 8080:8080` and open http://localhost:8080.

Frontend
--------
Run the Vite app and keep the proxy to `http://localhost:4000`:

```bash
cd web
npm install
npm run dev
```

Notes
-----
- Update image names in `auth.yaml`, `catalog.yaml`, `orders.yaml`, and `migrate-job.yaml` to match your registry.
- Google OAuth callback must match your public gateway URL. You can set `GOOGLE_CALLBACK_URL` in `secret.yaml` if needed.
- The pods read env from both `foodable-config` (ConfigMap) and `foodable-secrets` (Secret). Prisma expects `DATABASE_URL`.
