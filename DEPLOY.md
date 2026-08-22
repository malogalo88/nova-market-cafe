# Deploying NovaPOS with live QR ordering

The customer ordering page is served by the **same website** as the staff
dashboard. Orders are stored in a **Postgres database**, so phones can order
24/7 -- your laptop does not need to be on, and customers do not need to be
on your Wi-Fi.

```
Permanent QR code  -->  https://your-site.vercel.app/#/order/qr_table_1
                     -->  Vercel (website + /api functions)
                     -->  Postgres database (shared truth)
                     <--  staff dashboard polls and shows the order live
```

## 1. One-time setup

1. **Push this project to GitHub** (if it isn't already).

2. **Create / open the project in Vercel**
   - Import the repo (or use your existing Nova Market & Cafe project).
   - Framework preset: Vite. Build command `npm run build`, output `dist`
     (auto-detected). The `api/` folder deploys automatically as serverless
     functions -- no extra config.

3. **Create the database**
   - Vercel dashboard -> your project -> **Storage** -> **Create Database**
     -> Postgres (Neon). Any other Postgres works too (Supabase, Railway...).
   - Connect it to the project so these env vars are injected:
     - `POSTGRES_URL` (or `DATABASE_URL`)
   - The table (`novapos_state`) is created automatically on first request.

4. **Add one more environment variable** (Project -> Settings -> Environment
   Variables):
   - `NOVAPOS_SECRET` = any long random string (e.g. 64+ characters).
     This signs staff login tokens. If you skip it, a key derived from the
     database URL is used instead -- functional, but setting it explicitly
     is recommended.

5. **Deploy** (push to Git or click Redeploy).

## 2. Migrate your existing data

On the computer where you've been using NovaPOS:

1. Open the deployed site and sign in.
2. Settings -> Data -> **"Upload this browser's data to the server."**

Your products, sales history, customers, settings **and QR codes** become the
server's data. Because QR code ids are permanent slugs (`qr_table_1`), posters
you already printed keep working once they point at the production URL.

3. Settings -> QR Ordering -> set **Website address** to your production URL
   (e.g. `https://your-site.vercel.app`), then reprint codes if you want them
   to carry that address.

## 3. Local LAN mode (optional)

Without `POSTGRES_URL`/`DATABASE_URL` the backend falls back to a local file:

```
npm start          # build + serve dist/ and /api on http://0.0.0.0:8787
```

Handy at the counter; not required for phone ordering.

## Troubleshooting

**Build fails on Vercel with TypeScript import errors (TS2835)?**
Deploy the project exactly as checked in. Server-side files use explicit
`.js` import extensions (required by NodeNext resolution, which is how
Vercel compiles `api/[...path].ts`). Local equivalent check:
`npm run typecheck:server`.

**`server/pricing.ts` type error?**
That file is not part of the project -- pricing lives in `src/lib/pricing.ts`.
If your repository contains anything in `server/` besides `core.ts`,
`store.ts`, `index.ts`, delete it; it's a leftover from a partial copy.

**Health check returns 500 / FUNCTION_INVOCATION_FAILED?**
The deployment doesn't match this source tree. Redeploy the full folder
(partial file copies are the usual cause). Then `/api/health` must return
`{"ok":true,"storage":"postgres"}`.

## Notes & limits

- **Health check**: `https://your-site.vercel.app/api/health` must return
  `{"ok":true,"storage":"postgres",...}`. If it says `"storage":"file"`, the
  Postgres database isn't attached to the project (Vercel -> Storage).
- **Printed QR codes are permanent**: the ids `qr_table_1` (Table 1),
  `qr_table_2` (Table 2) and `qr_counter` (Counter) are guaranteed to exist
  server-side -- they are re-added automatically whenever data is seeded or
  migrated. Settings -> Data -> "Restore standard QR codes" repairs this
  manually anytime; your own/custom codes are never modified.
- Vercel caps request bodies around 4.5 MB: keep product/logo images small.
- Staff dashboards poll every ~4 s (tunable via `STAFF_POLL_MS` in
  `src/store/useStore.ts`). Lower intervals = faster order alerts but more
  database usage; Neon's free tier is fine for typical cafe hours.
- Stale-device safety: saves send a revision number; if phone orders arrived
  meanwhile, the server merges instead of overwriting, so no phone order or
  stock reservation can be lost by an out-of-date dashboard tab.
