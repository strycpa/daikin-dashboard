#!/usr/bin/env bash
set -euo pipefail

# Full GCP bootstrap for daikin-dashboard:
# project (+ billing), APIs, Artifact Registry, service accounts, secrets,
# Cloud Run, Cloud Build trigger.
#
# Usage (from repo root):
#   cp .env.example .env   # fill DAIKIN_CLIENT_ID, DAIKIN_CLIENT_SECRET
#   ./scripts/setup-gcp.sh
#
# Optional env:
#   GCP_PROJECT_ID          default: daikin-dashboard-prod (created if missing)
#   CREATE_PROJECT=1        create project when it does not exist (default: 1)
#   BILLING_ACCOUNT_ID      auto-picks first open billing account if unset
#   REGION                  europe-west1
#   GITHUB_OWNER / GITHUB_REPO / BRANCH_PATTERN
#   SKIP_TRIGGER=1          skip GitHub trigger creation
#   SKIP_DEPLOY=1           infra only, no Cloud Run deploy

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-daikin-dashboard}"
AR_REPO="${AR_REPO:-cloud-run-source-deploy}"
IMAGE_NAME="${IMAGE_NAME:-daikin-dashboard}"
TRIGGER_NAME="${TRIGGER_NAME:-daikin-dashboard-master}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^master$}"
RUNTIME_SA_ID="${RUNTIME_SA_ID:-daikin-dashboard}"
CREATE_PROJECT="${CREATE_PROJECT:-1}"

GITHUB_OWNER="${GITHUB_OWNER:-}"
GITHUB_REPO="${GITHUB_REPO:-}"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-daikin-dashboard-prod}"

ENV_FILE="${ROOT_DIR}/.env"
TOKEN_FILE="${ROOT_DIR}/.data/tokens.json"

read_env() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    return 1
  fi
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -1 || true)"
  if [[ -z "${line}" ]]; then
    return 1
  fi
  local value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "${value}" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

project_exists() {
  gcloud projects describe "${GCP_PROJECT_ID}" >/dev/null 2>&1
}

ensure_project() {
  if project_exists; then
    echo "==> Using existing project: ${GCP_PROJECT_ID}"
    return 0
  fi

  if [[ "${CREATE_PROJECT}" != "1" ]]; then
    echo "ERROR: Project ${GCP_PROJECT_ID} does not exist. Set CREATE_PROJECT=1 or create it manually."
    exit 1
  fi

  echo "==> Creating project: ${GCP_PROJECT_ID}"
  if [[ -n "${ORG_ID:-}" ]]; then
    gcloud projects create "${GCP_PROJECT_ID}" \
      --name="Daikin Dashboard" \
      --organization="${ORG_ID}"
  else
    gcloud projects create "${GCP_PROJECT_ID}" \
      --name="Daikin Dashboard"
  fi

  echo "==> Waiting for project propagation..."
  for _ in $(seq 1 30); do
    if project_exists; then
      break
    fi
    sleep 2
  done

  if ! project_exists; then
    echo "ERROR: Project ${GCP_PROJECT_ID} was not visible after create."
    exit 1
  fi
}

ensure_billing() {
  if [[ -n "${BILLING_ACCOUNT_ID:-}" ]]; then
    local billing_name="${BILLING_ACCOUNT_ID}"
    if [[ "${billing_name}" != billingAccounts/* ]]; then
      billing_name="billingAccounts/${BILLING_ACCOUNT_ID}"
    fi
  else
    echo "==> Resolving billing account..."
    billing_name="$(gcloud billing accounts list \
      --filter='open=true' \
      --format='value(name)' \
      --limit=1)"
    if [[ -z "${billing_name}" ]]; then
      echo "ERROR: No open billing account found. Set BILLING_ACCOUNT_ID."
      exit 1
    fi
  fi

  echo "==> Linking billing: ${billing_name}"
  if ! gcloud billing projects describe "${GCP_PROJECT_ID}" \
    --format='value(billingAccountName)' 2>/dev/null | grep -q .; then
    gcloud billing projects link "${GCP_PROJECT_ID}" \
      --billing-account="${billing_name#billingAccounts/}"
  fi
}

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" \
      --project="${GCP_PROJECT_ID}" \
      --data-file=-
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --project="${GCP_PROJECT_ID}" \
      --replication-policy=automatic \
      --data-file=-
  fi
}

grant_secret_accessor() {
  local secret_name="$1"
  local member="$2"
  gcloud secrets add-iam-policy-binding "${secret_name}" \
    --project="${GCP_PROJECT_ID}" \
    --member="${member}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

if [[ -z "${GITHUB_OWNER}" || -z "${GITHUB_REPO}" ]]; then
  REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
  if [[ "${REMOTE_URL}" =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
    GITHUB_OWNER="${BASH_REMATCH[1]}"
    GITHUB_REPO="${BASH_REMATCH[2]}"
  fi
fi

ensure_project
ensure_billing

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo unknown)"
echo "==> gcloud account: ${ACTIVE_ACCOUNT}"
echo "==> Active project: ${GCP_PROJECT_ID} (${REGION})"
gcloud config set project "${GCP_PROJECT_ID}" >/dev/null

echo "==> Enabling APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="${GCP_PROJECT_ID}"

echo "==> Artifact Registry: ${AR_REPO}"
create_ar_repo() {
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --description="Cloud Run deploy images"
}

if ! gcloud artifacts repositories describe "${AR_REPO}" \
  --location="${REGION}" \
  --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  set +e
  create_ar_repo
  ar_exit=$?
  set -e
  if [[ "${ar_exit}" -ne 0 ]]; then
    echo "==> Waiting for IAM propagation, retrying Artifact Registry..."
    sleep 30
    create_ar_repo
  fi
fi

PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')"
CB_SA="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
RUNTIME_SA_EMAIL="${RUNTIME_SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA_MEMBER="serviceAccount:${RUNTIME_SA_EMAIL}"

echo "==> Runtime service account: ${RUNTIME_SA_EMAIL}"
if ! gcloud iam service-accounts describe "${RUNTIME_SA_EMAIL}" \
  --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA_ID}" \
    --project="${GCP_PROJECT_ID}" \
    --display-name="Daikin Dashboard Cloud Run runtime"
fi

echo "==> Cloud Build IAM"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/secretmanager.admin; do
  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member="${CB_SA}" \
    --role="${role}" \
    --quiet >/dev/null
done

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA_EMAIL}" \
  --project="${GCP_PROJECT_ID}" \
  --member="${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null

echo "==> Secret Manager"
DAIKIN_CLIENT_ID="$(read_env DAIKIN_CLIENT_ID || true)"
DAIKIN_CLIENT_SECRET="$(read_env DAIKIN_CLIENT_SECRET || true)"
DASHBOARD_ACCESS_TOKEN="$(read_env DASHBOARD_ACCESS_TOKEN || true)"

if [[ -z "${DAIKIN_CLIENT_ID}" || -z "${DAIKIN_CLIENT_SECRET}" ]]; then
  echo "ERROR: DAIKIN_CLIENT_ID and DAIKIN_CLIENT_SECRET required in ${ENV_FILE}"
  exit 1
fi

if [[ -z "${DASHBOARD_ACCESS_TOKEN}" ]]; then
  DASHBOARD_ACCESS_TOKEN="$(openssl rand -base64 24 | tr -d '\n/+=')"
  echo "Generated DASHBOARD_ACCESS_TOKEN — add to .env:"
  echo "DASHBOARD_ACCESS_TOKEN=${DASHBOARD_ACCESS_TOKEN}"
fi

upsert_secret "daikin-client-id" "${DAIKIN_CLIENT_ID}"
upsert_secret "daikin-client-secret" "${DAIKIN_CLIENT_SECRET}"
upsert_secret "daikin-dashboard-access-token" "${DASHBOARD_ACCESS_TOKEN}"

for secret_name in daikin-client-id daikin-client-secret daikin-dashboard-access-token; do
  grant_secret_accessor "${secret_name}" "${RUNTIME_SA_MEMBER}"
done

if [[ -f "${TOKEN_FILE}" ]]; then
  if gcloud secrets describe daikin-tokens-json --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets versions add daikin-tokens-json \
      --project="${GCP_PROJECT_ID}" \
      --data-file="${TOKEN_FILE}"
  else
    gcloud secrets create daikin-tokens-json \
      --project="${GCP_PROJECT_ID}" \
      --replication-policy=automatic \
      --data-file="${TOKEN_FILE}"
  fi
else
  echo "WARN: ${TOKEN_FILE} missing — placeholder secret until OAuth"
  if gcloud secrets describe daikin-tokens-json --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    printf '{}' | gcloud secrets versions add daikin-tokens-json \
      --project="${GCP_PROJECT_ID}" \
      --data-file=-
  else
    printf '{}' | gcloud secrets create daikin-tokens-json \
      --project="${GCP_PROJECT_ID}" \
      --replication-policy=automatic \
      --data-file=-
  fi
fi
grant_secret_accessor "daikin-tokens-json" "${RUNTIME_SA_MEMBER}"

SERVICE_URL=""
PRODUCTION_REDIRECT=""

if [[ "${SKIP_DEPLOY:-}" != "1" ]]; then
  PLACEHOLDER_REDIRECT="daikin-dashboard-placeholder.${REGION}.run.app/api/auth/callback"

  echo "==> Cloud Run deploy (first pass)"
  gcloud run deploy "${SERVICE_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --source . \
    --region="${REGION}" \
    --platform=managed \
    --service-account="${RUNTIME_SA_EMAIL}" \
    --allow-unauthenticated \
    --memory=512Mi \
    --set-env-vars "DAIKIN_REDIRECT_URI=${PLACEHOLDER_REDIRECT},DAIKIN_TOKEN_FILE=/app/.data/tokens.json" \
    --set-secrets "DAIKIN_CLIENT_ID=daikin-client-id:latest,DAIKIN_CLIENT_SECRET=daikin-client-secret:latest,DAIKIN_TOKENS_JSON=daikin-tokens-json:latest,DASHBOARD_ACCESS_TOKEN=daikin-dashboard-access-token:latest" \
    --quiet

  SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(status.url)')"
  SERVICE_HOST="${SERVICE_URL#https://}"
  PRODUCTION_REDIRECT="${SERVICE_HOST}/api/auth/callback"

  echo "==> Cloud Run redirect URI: ${PRODUCTION_REDIRECT}"
  gcloud run services update "${SERVICE_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${REGION}" \
    --update-env-vars "DAIKIN_REDIRECT_URI=${PRODUCTION_REDIRECT},DAIKIN_PUBLIC_URL=${SERVICE_URL}" \
    --quiet
fi

if [[ "${SKIP_TRIGGER:-}" != "1" ]]; then
  echo "==> Cloud Build trigger (${BRANCH_PATTERN})"
  if [[ -z "${GITHUB_OWNER}" || -z "${GITHUB_REPO}" ]]; then
    echo "WARN: No GitHub remote — set GITHUB_OWNER/GITHUB_REPO and re-run."
  elif gcloud builds triggers describe "${TRIGGER_NAME}" \
    --region="${REGION}" \
    --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    echo "Trigger ${TRIGGER_NAME} already exists."
  else
    set +e
    gcloud builds triggers create github \
      --project="${GCP_PROJECT_ID}" \
      --name="${TRIGGER_NAME}" \
      --region="${REGION}" \
      --repo-name="${GITHUB_REPO}" \
      --repo-owner="${GITHUB_OWNER}" \
      --branch-pattern="${BRANCH_PATTERN}" \
      --build-config=cloudbuild.yaml
    TRIGGER_EXIT=$?
    set -e
    if [[ "${TRIGGER_EXIT}" -ne 0 ]]; then
      echo "WARN: GitHub trigger not created — connect repo in Cloud Build console and re-run."
      echo "https://console.cloud.google.com/cloud-build/triggers;region=${REGION}?project=${GCP_PROJECT_ID}"
    fi
  fi
fi

cat <<EOF

================================================================================
GCP setup complete

Project:    ${GCP_PROJECT_ID}
Region:     ${REGION}
Service:    ${SERVICE_NAME}
URL:        ${SERVICE_URL:-skipped}
Redirect:   ${PRODUCTION_REDIRECT:-set after deploy}

Secrets in Secret Manager:
  - daikin-client-id
  - daikin-client-secret
  - daikin-tokens-json
  - daikin-dashboard-access-token

Dashboard login: HTTP Basic, password = DASHBOARD_ACCESS_TOKEN

Daikin Developer Portal redirect (no https://):
  ${PRODUCTION_REDIRECT:-<after deploy>}

Re-run after local OAuth to refresh tokens:
  gcloud secrets versions add daikin-tokens-json --data-file=.data/tokens.json --project=${GCP_PROJECT_ID}

Test CD pipeline:
  gcloud builds submit --config cloudbuild.yaml --project=${GCP_PROJECT_ID}

EOF
