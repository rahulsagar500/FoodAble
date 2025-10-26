#!/usr/bin/env bash
set -euo pipefail

# ==============================
# Foodable: GKE Autopilot deploy
# ==============================
# This script builds/pushes images, creates/uses a GKE Autopilot cluster,
# wires Cloud SQL (Postgres) via Cloud SQL Auth Proxy sidecars, applies
# Kubernetes manifests, runs Prisma migrations (and optional seeding),
# and exposes the gateway via GKE Ingress.
#
# Defaults are set for your project/region; override by exporting envs before running.
# Example: PROJECT_ID=my-proj REGION=us-central1 SEED=true bash scripts/deploy_gke.sh

# --- Config (override via env) ---
PROJECT_ID=${PROJECT_ID:-tribal-cortex-443513-g5}
REGION=${REGION:-asia-southeast1}
CLUSTER_NAME=${CLUSTER_NAME:-foodable-autopilot}
AR_REPO=${AR_REPO:-foodable}
NAMESPACE=${NAMESPACE:-foodable-dev}

# Cloud SQL
DB_NAME=${DB_NAME:-foodable}
DB_USER=${DB_USER:-postgres}
# Connection name will be read if not provided
CONNECTION_NAME=${CONNECTION_NAME:-}

# Seed control (true/false)
SEED=${SEED:-false}

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "Project: $PROJECT_ID | Region: $REGION | Cluster: $CLUSTER_NAME"
echo "Namespace: $NAMESPACE | AR repo: $AR_REPO | Seed: $SEED"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "Ensuring required services are enabled..."
gcloud services enable container.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com >/dev/null

echo "Ensuring Artifact Registry repo exists..."
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION"
fi

AR_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO"

build_and_push() {
  local image_tag=$1
  local dockerfile=$2
  local context=$3
  if command -v docker >/dev/null 2>&1; then
    echo "[docker] Building $image_tag"
    gcloud auth configure-docker "$REGION-docker.pkg.dev" -q
    docker build -t "$image_tag" -f "$dockerfile" "$context"
    docker push "$image_tag"
  else
    echo "[cloud build] Building $image_tag"
    gcloud builds submit "$context" --config=- <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build','-t','$image_tag','-f','$dockerfile','.']
images: ['$image_tag']
EOF
  fi
}

echo "Building and pushing images... (this may take a few minutes)"
build_and_push "$AR_BASE/auth:v1"    api/services/auth/Dockerfile    api
build_and_push "$AR_BASE/catalog:v1" api/services/catalog/Dockerfile api
build_and_push "$AR_BASE/orders:v1"  api/services/orders/Dockerfile  api

echo "Creating or reusing GKE Autopilot cluster..."
if ! gcloud container clusters describe "$CLUSTER_NAME" --region "$REGION" >/dev/null 2>&1; then
  gcloud container clusters create-auto "$CLUSTER_NAME" --region "$REGION"
fi
gcloud container clusters get-credentials "$CLUSTER_NAME" --region "$REGION" --project "$PROJECT_ID"

echo "Resolving Cloud SQL connection name..."
if [[ -z "$CONNECTION_NAME" ]]; then
  # Attempt to find instance named foodable-sql; otherwise, ask user
  CONNECTION_NAME=$(gcloud sql instances list --format="value(connectionName)" | grep ":foodable-sql$" || true)
  if [[ -z "$CONNECTION_NAME" ]]; then
    echo "Could not auto-detect Cloud SQL connection name. Set CONNECTION_NAME env and rerun."
    echo "Format: project:region:instance (e.g., $PROJECT_ID:$REGION:foodable-sql)"
    exit 1
  fi
fi
echo "Using Cloud SQL: $CONNECTION_NAME"

echo "Templating manifests with project/region and connection name..."
sed -i "s|asia-southeast1-docker.pkg.dev/tribal-cortex-443513-g5/$AR_REPO|$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO|g" infra/k8s/deployments/*.yaml || true
sed -i "s|tribal-cortex-443513-g5:asia-southeast1:foodable-sql|$CONNECTION_NAME|g" infra/k8s/deployments/*.yaml infra/k8s/jobs/*.yaml || true

echo "Creating namespace and base resources..."
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmaps/gateway-configmap.yaml
kubectl apply -f infra/k8s/services/

echo "Creating Kubernetes service account and binding Workload Identity..."
GSA_EMAIL="foodable-sa@$PROJECT_ID.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$GSA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create foodable-sa --display-name "Foodable GKE SA"
fi
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$GSA_EMAIL" \
  --role="roles/cloudsql.client" >/dev/null

kubectl -n "$NAMESPACE" create serviceaccount app-sa --dry-run=client -o yaml | kubectl apply -f -
gcloud iam service-accounts add-iam-policy-binding "$GSA_EMAIL" \
  --member="serviceAccount:$PROJECT_ID.svc.id.goog[$NAMESPACE/app-sa]" \
  --role="roles/iam.workloadIdentityUser" >/dev/null
kubectl -n "$NAMESPACE" annotate serviceaccount app-sa \
  iam.gke.io/gcp-service-account="$GSA_EMAIL" --overwrite

echo "Applying deployments..."
kubectl apply -f infra/k8s/deployments/

echo "Setting service account on deployments and restarting..."
kubectl -n "$NAMESPACE" set serviceaccount deployment/auth app-sa || true
kubectl -n "$NAMESPACE" set serviceaccount deployment/catalog app-sa || true
kubectl -n "$NAMESPACE" set serviceaccount deployment/orders app-sa || true
kubectl -n "$NAMESPACE" set serviceaccount deployment/gateway app-sa || true
kubectl -n "$NAMESPACE" rollout restart deployment auth catalog orders gateway || true

echo "Creating Kubernetes Secret 'app-secrets' from Secret Manager values..."
DB_PASS=$(gcloud secrets versions access latest --secret=db-password)
JWT_SECRET_VAL=$(gcloud secrets versions access latest --secret=jwt-secret)
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?sslmode=disable"
kubectl -n "$NAMESPACE" delete secret app-secrets --ignore-not-found
kubectl -n "$NAMESPACE" create secret generic app-secrets \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET_VAL"

echo "Restarting app deployments to pick up secrets..."
kubectl -n "$NAMESPACE" rollout restart deployment auth catalog orders || true

echo "Running Prisma migrations..."
kubectl -n "$NAMESPACE" delete job prisma-migrate --ignore-not-found
kubectl -n "$NAMESPACE" apply -f infra/k8s/jobs/migrate.yaml
kubectl -n "$NAMESPACE" patch job prisma-migrate -p '{"spec":{"template":{"spec":{"serviceAccountName":"app-sa"}}}}'
kubectl -n "$NAMESPACE" wait --for=condition=complete job/prisma-migrate --timeout=300s

if [[ "$SEED" == "true" ]]; then
  echo "Seeding demo data..."
  kubectl -n "$NAMESPACE" delete job prisma-seed --ignore-not-found
  kubectl -n "$NAMESPACE" apply -f infra/k8s/jobs/seed.yaml
  kubectl -n "$NAMESPACE" patch job prisma-seed -p '{"spec":{"template":{"spec":{"serviceAccountName":"app-sa"}}}}'
  kubectl -n "$NAMESPACE" wait --for=condition=complete job/prisma-seed --timeout=300s
fi

echo "Creating Ingress for gateway..."
kubectl -n "$NAMESPACE" apply -f infra/k8s/ingress.yaml

echo "Waiting for external IP..."
for i in {1..60}; do
  EXT_IP=$(kubectl -n "$NAMESPACE" get ingress gateway-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  [[ -n "$EXT_IP" ]] && break || sleep 10
done

if [[ -z "$EXT_IP" ]]; then
  echo "Ingress IP not ready yet. Check later with: kubectl -n $NAMESPACE get ingress"
  exit 0
fi

echo "Gateway is available at: http://$EXT_IP"
echo "Health check:    curl http://$EXT_IP/healthz"
echo "Frontend .env:   VITE_API_BASE=http://$EXT_IP"
