Kubernetes Secrets required (created from GCP Secret Manager values)

Prereqs
- gcloud CLI authenticated and kubectl pointing to your GKE cluster

Fetch secrets from Secret Manager and create a Kubernetes Secret named `app-secrets` in `foodable-dev`:

REGION=asia-southeast1
NAMESPACE=foodable-dev
DB_NAME=foodable
DB_USER=postgres
DB_PASS=$(gcloud secrets versions access latest --secret=db-password)
JWT_SECRET=$(gcloud secrets versions access latest --secret=jwt-secret)

# Build DATABASE_URL for Cloud SQL Auth Proxy (127.0.0.1:5432)
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?sslmode=disable"

kubectl -n $NAMESPACE delete secret app-secrets --ignore-not-found
kubectl -n $NAMESPACE create secret generic app-secrets \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET"

# Optional Google OAuth secrets (uncomment and add values)
# kubectl -n $NAMESPACE create secret generic app-secrets \
#   --from-literal=GOOGLE_CLIENT_ID=... \
#   --from-literal=GOOGLE_CLIENT_SECRET=... \
#   --dry-run=client -o yaml | kubectl apply -f -

