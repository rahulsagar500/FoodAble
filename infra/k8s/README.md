Foodable on GKE Autopilot (asia-southeast1)

Prereqs
- gcloud configured for project tribal-cortex-443513-g5 and region asia-southeast1
- GKE Autopilot cluster created and kubectl context set
- Cloud SQL Postgres created: tribal-cortex-443513-g5:asia-southeast1:foodable-sql
- Images pushed to Artifact Registry:
  - asia-southeast1-docker.pkg.dev/tribal-cortex-443513-g5/foodable/auth:v1
  - asia-southeast1-docker.pkg.dev/tribal-cortex-443513-g5/foodable/catalog:v1
  - asia-southeast1-docker.pkg.dev/tribal-cortex-443513-g5/foodable/orders:v1

Apply manifests
kubectl apply -f namespace.yaml
kubectl apply -f configmaps/gateway-configmap.yaml
kubectl apply -f services/
kubectl apply -f deployments/

# Create app secrets from GCP Secret Manager values
kubectl apply -f secrets/README.md   # read and run the commands inside

# Run migrations (one-time)
kubectl apply -f jobs/migrate.yaml
kubectl wait --for=condition=complete job/prisma-migrate -n foodable-dev --timeout=180s

# Optional: seed demo data
kubectl apply -f jobs/seed.yaml
kubectl wait --for=condition=complete job/prisma-seed -n foodable-dev --timeout=180s

# Gateway ingress
kubectl apply -f ingress.yaml

Check status
kubectl -n foodable-dev get deploy,svc,ingress,pods

Ingress will provision a GCLB. Once an address appears, open http://ADDRESS/healthz

Notes
- Each service includes a Cloud SQL Auth Proxy sidecar and uses DATABASE_URL pointing to 127.0.0.1:5432.
- Secrets are provided via a Kubernetes Secret (app-secrets). For production, consider using Secret Manager CSI driver.
- To scale: edit HPA files in infra/k8s/hpa and apply.
- To ensure availability during maintenance, apply PodDisruptionBudgets in infra/k8s/pdb.

