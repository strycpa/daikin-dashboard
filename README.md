# Daikin Dashboard

Next.js dashboard for controlling multiple Daikin Comfora units via the Onecta cloud API.

## Features

- Live status for all AC units in a household/site
- Per-unit controls (power, mode, temperature, fan)
- Master panel with checkboxes to batch-apply settings
- Site selector (or hardcode via `DAIKIN_SITE_ID`)
- Demo mode with 5 sample units when credentials are missing

## Setup

1. Register an app at [Daikin Developer Portal](https://developer.cloud.daikineurope.com/)
2. Set redirect URI to your **production** Cloud Run host (Daikin allows only one app / one URI):
   `your-service.europe-west1.run.app/api/auth/callback` (no `http://`)
3. Copy credentials:

```bash
cp .env.example .env
# fill DAIKIN_CLIENT_ID and DAIKIN_CLIENT_SECRET
```

4. Optional room labels:

```env
DAIKIN_ROOM_LABELS={"your-device-uuid":"Obývák","another-uuid":"Ložnice"}
```

5. Run:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and complete OAuth via the connect panel.

### Local dev with a single Daikin redirect URI

Daikin Developer Portal allows **one redirect URI** per app. Point it at production:

```text
daikin-dashboard-XXXX.europe-west1.run.app/api/auth/callback
```

In local `.env` set the same value:

```env
DAIKIN_REDIRECT_URI=daikin-dashboard-XXXX.europe-west1.run.app/api/auth/callback
```

After Daikin consent, the production `/api/auth/callback` reads `state` and redirects the
authorization code back to `http://localhost:3000/api/auth/callback` (or to production when
you log in there). Token exchange still uses the registered redirect URI above.

Optional overrides:

```env
DAIKIN_OAUTH_RETURN_URI=http://localhost:3000/api/auth/callback
DAIKIN_PUBLIC_URL=https://daikin-dashboard-XXXX.europe-west1.run.app
```

### OAuth without proxy (legacy manual flow)

If redirect URI is `localhost:3000/...` without `http://`, the browser cannot open it after consent.
Use the manual paste flow in the connect panel, or switch to the shared production proxy above.

## API rate limits

Daikin limits cloud API to ~200 requests/day and 20/minute. Batch controls include a short delay between units.

## Deploy to Google Cloud Run

Same pattern as [solax-mcp](~/git/mcp/solax-mcp): build from `Dockerfile`, deploy with `gcloud run deploy`, secrets in Secret Manager.

### 1. Prerequisites

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT
gcloud services enable run.googleapis.com secretmanager.googleapis.com
```

### 2. Create secrets

```bash
printf '%s' 'YOUR_CLIENT_ID' | gcloud secrets create daikin-client-id --data-file=-
printf '%s' 'YOUR_CLIENT_SECRET' | gcloud secrets create daikin-client-secret --data-file=-
printf '%s' 'YOUR_DASHBOARD_PASSWORD' | gcloud secrets create daikin-dashboard-access-token --data-file=-

# After local OAuth, upload tokens for cold starts:
gcloud secrets create daikin-tokens-json --data-file=.data/tokens.json
```

Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on these secrets.

### 3. Deploy

```bash
cd /Users/strycpa/github/strycpa/daikin-dashboard

gcloud run deploy daikin-dashboard \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars DAIKIN_REDIRECT_URI=YOUR_SERVICE_HOSTNAME/api/auth/callback,DAIKIN_TOKEN_FILE=/app/.data/tokens.json \
  --set-secrets DAIKIN_CLIENT_ID=daikin-client-id:latest,DAIKIN_CLIENT_SECRET=daikin-client-secret:latest,DAIKIN_TOKENS_JSON=daikin-tokens-json:latest,DASHBOARD_ACCESS_TOKEN=daikin-dashboard-access-token:latest
```

Replace `YOUR_SERVICE_HOSTNAME` with the Cloud Run host **without** `https://`, e.g. `daikin-dashboard-123456.europe-west1.run.app` — same format as Daikin Developer Portal expects.

After the first deploy, note the URL:

```bash
gcloud run services describe daikin-dashboard --region europe-west1 --format='value(status.url)'
```

Register redirect URI in Daikin portal:

```text
daikin-dashboard-XXXX.europe-west1.run.app/api/auth/callback
```

Update `DAIKIN_REDIRECT_URI` to match and redeploy if needed.

### 4. OAuth on production

1. Open the Cloud Run URL (browser prompts for Basic auth if `DASHBOARD_ACCESS_TOKEN` is set).
2. Complete Daikin login via the connect panel (manual code paste still works if Daikin uses scheme-less redirect).
3. Refresh tokens are cached in the container filesystem; for durable cold starts keep `daikin-tokens-json` secret updated from `.data/tokens.json` after re-auth.

### 5. Health check

`GET /api/health` returns `{"ok":true}` (no auth).

### 6. Continuous deploy (Cloud Build)

Push to `master` builds the Docker image and deploys to Cloud Run (`cloudbuild.yaml`).

**Full GCP bootstrap (recommended):**

```bash
cp .env.example .env   # fill DAIKIN_CLIENT_ID, DAIKIN_CLIENT_SECRET
# optional: complete local OAuth so .data/tokens.json exists

chmod +x scripts/setup-gcp.sh
export GCP_PROJECT_ID=your-project
export GITHUB_OWNER=strycpa      # optional if git remote is set
export GITHUB_REPO=daikin-dashboard
./scripts/setup-gcp.sh
```

Creates: APIs, Artifact Registry, runtime service account, Secret Manager secrets,
Cloud Run service, IAM for Cloud Build, GitHub trigger on `master`.

If GitHub is not connected yet, the script prints console URL to link it and re-run.

**Manual pipeline run:**

```bash
gcloud builds submit --config cloudbuild.yaml
```

## Tech stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
