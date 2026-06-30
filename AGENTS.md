<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Stack: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4. Package manager is `pnpm` (see `packageManager` in `package.json`). Node 22 is the supported runtime.
- Run dev: `pnpm dev` (Turbopack, serves on `http://localhost:3000`). Scripts are in `package.json` (`dev`, `dev:webpack`, `build`, `start`, `lint`).
- No secrets needed for local development: when `DAIKIN_CLIENT_ID` is unset and `NODE_ENV=development`, the app auto-enables demo mode (`loadDaikinConfig` in `src/lib/daikin/config.ts`) and serves 5 in-memory sample AC units, so the full dashboard + controls work offline. Force it anywhere with `DAIKIN_DEMO_MODE=true`. Demo control state is in-memory only and resets on server restart.
- Real Daikin Onecta access (live units, OAuth) requires `DAIKIN_CLIENT_ID`/`DAIKIN_CLIENT_SECRET`; Firestore token storage additionally needs `GCP_PROJECT_ID`/`GOOGLE_CLOUD_PROJECT`. These are only for non-demo/production flows — see `README.md` and `.env.example`.
- `pnpm lint`, `pnpm build`, and `pnpm dev` all pass cleanly. Lint uses `eslint-config-next` with the React Hooks rules, including `react-hooks/set-state-in-effect`: prefer awaiting state-setting async loaders inside the effect (e.g. `await loadX()` in an async IIFE) rather than floating `void loadX().then(...)`, since the rule flags floating promise chains and synchronous setState in effect bodies.
