#!/usr/bin/env bash
set -euo pipefail

# Defaults
USE_MINIKUBE=0
USE_INCLUSTER_DB=0
USE_INGRESS=""
NAMESPACE="foodable"

# Optional auth/frontend inputs
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL=""
FRONTEND_ORIGIN=""

usage() {
  cat <<EOF
Usage: ./deploy.sh [--minikube] [--inclusterdb] [--ingress|--no-ingress] [--namespace NAME]

Options:
  --minikube            Build images into minikube's Docker and enable Ingress by default
  --inclusterdb         Use in-cluster Postgres (k8s/postgres.yaml) instead of local DB
  --ingress             Use Ingress (foodable.local) for access
  --no-ingress          Do not use Ingress; port-forward gateway instead
  --namespace N         Kubernetes namespace (default: foodable)
  --google-client-id X  Google OAuth Client ID
  --google-client-secret X  Google OAuth Client Secret
  --google-callback X   Full Google OAuth callback URL
  --frontend-origin X   Frontend origin for CORS (default http://localhost:5173)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --minikube) USE_MINIKUBE=1; shift ;;
    --inclusterdb) USE_INCLUSTER_DB=1; shift ;;
    --ingress) USE_INGRESS=1; shift ;;
    --no-ingress) USE_INGRESS=0; shift ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --google-client-id) GOOGLE_CLIENT_ID="$2"; shift 2 ;;
    --google-client-secret) GOOGLE_CLIENT_SECRET="$2"; shift 2 ;;
    --google-callback) GOOGLE_CALLBACK_URL="$2"; shift 2 ;;
    --frontend-origin) FRONTEND_ORIGIN="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "${USE_INGRESS}" ]]; then
  USE_INGRESS=$USE_MINIKUBE
fi

step() { echo -e "\n==> $*"; }
ok() { echo "✔ $*"; }
warn() { echo "! $*"; }

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT="$SCRIPT_DIR"
K8S_DIR="$REPO_ROOT/k8s"
API_DIR="$REPO_ROOT/api"

if [[ ! -d "$K8S_DIR" || ! -d "$API_DIR" ]]; then
  echo "This script must be run from the repo root (where k8s/ and api/ exist)."
  exit 1
fi

# 1) If minikube, point Docker to minikube daemon
if [[ "$USE_MINIKUBE" == "1" ]]; then
  step "Configuring Docker to use minikube daemon"
  # shellcheck disable=SC2046
  eval $(minikube docker-env)
  ok "Docker now points to minikube"
fi

# 2) Build images locally
step "Building service images"
docker build -f "$API_DIR/services/auth/Dockerfile"    -t foodable-auth:latest    "$API_DIR"
docker build -f "$API_DIR/services/catalog/Dockerfile" -t foodable-catalog:latest "$API_DIR"
docker build -f "$API_DIR/services/orders/Dockerfile"  -t foodable-orders:latest  "$API_DIR"
ok "Images built: foodable-{auth,catalog,orders}:latest"

# 3) Apply namespace and configmap
step "Applying namespace and configmap"
kubectl apply -f "$K8S_DIR/namespace.yaml"
kubectl apply -f "$K8S_DIR/configmap.yaml"

# 4) Prepare and apply Secret
step "Preparing Secret (JWT + DATABASE_URL)"
SECRET_LOCAL="$K8S_DIR/secret.local.yaml"
SECRET_TPL="$K8S_DIR/secret.template.yaml"
SECRET_OUT="$K8S_DIR/secret.yaml"

# If a local secret file exists, prefer it and skip mutation
if [[ -f "$SECRET_LOCAL" ]]; then
  kubectl apply -f "$SECRET_LOCAL"
  ok "Applied $SECRET_LOCAL"
else
  [[ -f "$SECRET_OUT" ]] || cp "$SECRET_TPL" "$SECRET_OUT"

# Pull defaults from api/.env.compose when present
ENV_FILE="$API_DIR/.env.compose"
if [[ -f "$ENV_FILE" ]]; then
  # helper to read KEY=VALUE (last match wins)
  get_env() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }
  [[ -z "$GOOGLE_CLIENT_ID" ]] && GOOGLE_CLIENT_ID="$(get_env GOOGLE_CLIENT_ID || true)"
  [[ -z "$GOOGLE_CLIENT_SECRET" ]] && GOOGLE_CLIENT_SECRET="$(get_env GOOGLE_CLIENT_SECRET || true)"
  [[ -z "$GOOGLE_CALLBACK_URL" ]] && GOOGLE_CALLBACK_URL="$(get_env GOOGLE_CALLBACK_URL || true)"
  [[ -z "$FRONTEND_ORIGIN" ]] && FRONTEND_ORIGIN="$(get_env FRONTEND_ORIGIN || true)"
  ENV_DB_URL="$(get_env DATABASE_URL || true)"
  ENV_JWT_SECRET="$(get_env JWT_SECRET || true)"
fi

# JWT: prefer existing from env file; otherwise generate
if [[ -n "${ENV_JWT_SECRET:-}" ]]; then
  JWT="$ENV_JWT_SECRET"
else
  if command -v openssl >/dev/null 2>&1; then
    JWT=$(openssl rand -hex 64)
  else
    if command -v uuidgen >/dev/null 2>&1; then
      JWT="$(uuidgen | tr -d '-')$(uuidgen | tr -d '-')"
    else
      JWT="$(date +%s%N)$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    fi
  fi
fi

if [[ "$USE_INCLUSTER_DB" == "1" ]]; then
  DB_URL='postgresql://foodable:foodable@postgres:5432/foodable?schema=public'
else
  if [[ -n "${ENV_DB_URL:-}" ]]; then
    DB_URL="$ENV_DB_URL"
  else
    if [[ "$USE_MINIKUBE" == "1" ]]; then
      DB_HOST='host.minikube.internal'
    else
      DB_HOST='host.docker.internal'
    fi
    DB_URL="postgresql://postgres:Meena%23123@${DB_HOST}:5435/foodable?schema=public"
  fi
fi

# In-place replace values in secret.yaml
  sed -E -i.bak "s|JWT_SECRET: \".*\"|JWT_SECRET: \"${JWT}\"|g" "$SECRET_OUT"
  sed -E -i.bak "s|DATABASE_URL: \".*\"|DATABASE_URL: \"${DB_URL}\"|g" "$SECRET_OUT"
# Set Google OAuth if provided, otherwise leave as-is
  if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
    sed -E -i.bak "s|GOOGLE_CLIENT_ID: \".*\"|GOOGLE_CLIENT_ID: \"${GOOGLE_CLIENT_ID}\"|g" "$SECRET_OUT"
  fi
  if [[ -n "$GOOGLE_CLIENT_SECRET" ]]; then
    sed -E -i.bak "s|GOOGLE_CLIENT_SECRET: \".*\"|GOOGLE_CLIENT_SECRET: \"${GOOGLE_CLIENT_SECRET}\"|g" "$SECRET_OUT"
  fi
# Derive callback if not provided
if [[ -z "$GOOGLE_CALLBACK_URL" ]]; then
  if [[ "$USE_INGRESS" == "1" ]]; then
    GOOGLE_CALLBACK_URL='http://foodable.local/api/auth/google/callback'
  else
    GOOGLE_CALLBACK_URL='http://localhost:4000/api/auth/google/callback'
  fi
fi
  sed -E -i.bak "s|GOOGLE_CALLBACK_URL: \".*\"|GOOGLE_CALLBACK_URL: \"${GOOGLE_CALLBACK_URL}\"|g" "$SECRET_OUT"
  rm -f "$SECRET_OUT.bak"
  kubectl apply -f "$SECRET_OUT"
  ok "Secret applied (DB_URL=${DB_URL})"
fi

# 4b) Optionally patch frontend origin
if [[ -z "$FRONTEND_ORIGIN" ]]; then
  FRONTEND_ORIGIN='http://localhost:5173'
fi
step "Patching ConfigMap FRONTEND_ORIGIN=${FRONTEND_ORIGIN}"
kubectl -n "$NAMESPACE" patch configmap foodable-config -p "{\"data\":{\"FRONTEND_ORIGIN\":\"${FRONTEND_ORIGIN}\"}}" >/dev/null 2>&1 || true

# 5) Optional in-cluster Postgres
if [[ "$USE_INCLUSTER_DB" == "1" ]]; then
  step "Deploying in-cluster Postgres"
  kubectl apply -f "$K8S_DIR/postgres.yaml"
  kubectl -n "$NAMESPACE" rollout status sts/postgres --timeout=180s
  ok "Postgres ready"
  # Optional adminer
  kubectl apply -f "$K8S_DIR/adminer.yaml" || true
fi

# 6) Prisma migrations
step "Running Prisma migrations"
kubectl apply -f "$K8S_DIR/migrate-job.yaml"
kubectl -n "$NAMESPACE" wait --for=condition=complete job/prisma-migrate --timeout=180s
kubectl -n "$NAMESPACE" logs job/prisma-migrate || true
ok "Migrations completed"

# 7) Deploy services
step "Deploying services"
kubectl apply -f "$K8S_DIR/auth.yaml"
kubectl apply -f "$K8S_DIR/catalog.yaml"
kubectl apply -f "$K8S_DIR/orders.yaml"
kubectl apply -f "$K8S_DIR/gateway.yaml"
kubectl -n "$NAMESPACE" rollout status deploy/auth --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/catalog --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/orders --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/gateway --timeout=180s
ok "Services ready"

# 8) Access & smoke tests
if [[ "$USE_INGRESS" == "1" ]]; then
  step "Applying Ingress (host: foodable.local)"
  kubectl apply -f "$K8S_DIR/ingress.yaml"
  warn "If using minikube: run 'minikube addons enable ingress' and map 'foodable.local' to minikube IP in hosts file."
  set +e
  curl -fsS -m 10 http://foodable.local/healthz && echo " [OK] /healthz" || echo " [ERR] /healthz"
  curl -fsS -m 10 http://foodable.local/api/restaurants >/dev/null && echo " [OK] /api/restaurants" || echo " [ERR] /api/restaurants"
  curl -fsS -m 10 http://foodable.local/api/offers >/dev/null && echo " [OK] /api/offers" || echo " [ERR] /api/offers"
  # OAuth endpoint check only if client id/secret provided
  if [[ -n "$GOOGLE_CLIENT_ID" && -n "$GOOGLE_CLIENT_SECRET" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" http://foodable.local/api/auth/google || true)
    echo " [/api/auth/google -> $code] (302 expected if configured in Google)"
  else
    warn "Google OAuth not configured (no client id/secret passed). You'll see google_oauth_disabled."
  fi
  set -e
else
  step "Port-forward gateway on :4000 for tests"
  kubectl -n "$NAMESPACE" port-forward svc/gateway 4000:4000 >/dev/null 2>&1 &
  PF_PID=$!
  sleep 3
  set +e
  curl -fsS -m 10 http://localhost:4000/healthz && echo " [OK] /healthz" || echo " [ERR] /healthz"
  curl -fsS -m 10 http://localhost:4000/api/restaurants >/dev/null && echo " [OK] /api/restaurants" || echo " [ERR] /api/restaurants"
  curl -fsS -m 10 http://localhost:4000/api/offers >/dev/null && echo " [OK] /api/offers" || echo " [ERR] /api/offers"
  if [[ -n "$GOOGLE_CLIENT_ID" && -n "$GOOGLE_CLIENT_SECRET" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/auth/google || true)
    echo " [/api/auth/google -> $code] (302 expected if configured in Google)"
  else
    warn "Google OAuth not configured (no client id/secret passed). You'll see google_oauth_disabled."
  fi
  set -e
  kill "$PF_PID" >/dev/null 2>&1 || true
fi

echo "\nAll done. Frontend: cd web && npm install && npm run dev" 
