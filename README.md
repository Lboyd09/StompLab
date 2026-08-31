# Stomp Lab

Research a song. Get a Line 6 HX Stomp preset you can import in HX Edit.

Stomp Lab maps recorded/live guitar and bass rigs onto the HX Stomp / HX Stomp XL: signal path, knobs, snapshots, footswitches, and a `.hlx` file.

## What visitors do

1. Open a demo (Enter Sandman, Smells Like Teen Spirit, Comfortably Numb) — always free, never Gemini.
2. Sign in with email. Three custom songs are free. Then a one-time unlock ($19 launch / $29) via Polar.
3. Download `.hlx` → HX Edit → File → Import. Put the unit in **Snapshot mode** so FS1–FS3 recall intro / verse / chorus.

Paid users get 50 Gemini builds per calendar month. Featured, demos, and cache hits do not count. The shared library is paid-only.

## Stack

- TanStack Start + React 19 + Tailwind v4
- Auth: Better Auth email/password (no social login)
- Shared cache + entitlements: Postgres (Neon in production, PGLite in local preview)
- Gemini 2.5 Flash only, via Vercel AI Gateway (`google/gemini-2.5-flash`)
- Polar checkout (merchant of record)

## Deploy (GitHub → Vercel)

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Neon Postgres is already attached (`DATABASE_URL`).
4. Set on Vercel:
   - `AI_GATEWAY_API_KEY` (or rely on `VERCEL_OIDC_TOKEN`)
   - `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET`
   - optional `POLAR_DISCOUNT_ID` for the $19 launch coupon, `POLAR_SERVER=sandbox` while testing
5. Polar webhook URL: `https://stomplab.vercel.app/api/polar/webhook`

Admin: `liamjamesb09@gmail.com` at `/admin` (not in the nav).

## Local

```bash
npm install
npm run dev
```
