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
2. Set redirect URI to **`localhost:3000/api/auth/callback`** (Daikin portal usually does not allow `http://`)
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

### OAuth stuck after consent?

Daikin Developer Portal often only accepts redirect URIs **without** `http://`, e.g. `localhost:3000/api/auth/callback`. After consent the browser cannot open that URL automatically (console error: `Failed to launch 'localhost:3000/...'`).

**Workaround (built into the dashboard):**

1. Click **Přihlásit u Daikin**
2. Approve scopes in Daikin
3. Open browser DevTools → Console
4. Copy the full `localhost:3000/api/auth/callback?code=...&state=...` line from the error
5. Paste it into the dashboard and click **Dokončit přihlášení**

Set the same redirect URI in `.env`:

```env
DAIKIN_REDIRECT_URI=localhost:3000/api/auth/callback
```

## API rate limits

Daikin limits cloud API to ~200 requests/day and 20/minute. Batch controls include a short delay between units.

## Tech stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
