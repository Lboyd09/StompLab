# Stomp Lab

Research a song. Get a Line 6 HX Stomp (or POD Go) preset you can import.

Stomp Lab maps recorded/live guitar and bass rigs onto HX Stomp / XL / Helix / HX Effects / POD Go: signal path, knobs, snapshots, footswitches, and a factory-safe `.hlx` or `.pgp` file.

## What visitors do

1. Open a demo (Enter Sandman, Smells Like Teen Spirit, Comfortably Numb) — always free, always downloadable.
2. Sign in with email. Three custom songs are free. Then subscribe: **$6.99/month** or **$75/year** via Polar (50 custom builds a month).
3. Download `.hlx` → HX Edit → File → Import, or `.pgp` → POD Go Edit. Put the unit in **Snapshot mode** so the numbered switches recall intro / verse / chorus.

Cache hits still count as a build. Users never see a shared library. Featured demos never count. Other known rigs are replica-only until subscribe. Admin is `liamjamesb09@gmail.com` at `/admin` (not in the nav).

## Stack

- TanStack Start + React 19 + Tailwind v4
- Auth: Better Auth email/password
- Shared cache + entitlements: Postgres (Neon in production, PGLite in local preview)
- Gemini 2.5 Flash only, via Vercel AI Gateway (`google/gemini-2.5-flash`)
- Polar checkout (merchant of record)
- Amazon Associates for original-gear shop links (`VITE_AMAZON_ASSOCIATE_TAG`)

## Deploy (GitHub → Vercel)

1. Push this repo to GitHub.
2. Import the project in Vercel. Attach the **custom domain** as the production domain.
3. Neon Postgres is already attached (`DATABASE_URL`).
4. Set on Vercel:
   - `APP_ORIGIN=https://YOUR-DOMAIN` (the domain you bought — no trailing slash)
   - `BETTER_AUTH_URL=https://YOUR-DOMAIN` (same value; keep stomplab.vercel.app working too)
   - `BETTER_AUTH_SECRET` (long random string — keep it stable or sessions reset)
   - `AI_GATEWAY_API_KEY` from Vercel AI Gateway
   - `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID_MONTHLY`, `POLAR_PRODUCT_ID_YEARLY`, `POLAR_WEBHOOK_SECRET`
   - `VITE_AMAZON_ASSOCIATE_TAG` (do not invent this — paste the real Store ID)
   - optional `EXTRA_AUTH_HOSTS=www.YOUR-DOMAIN,stomplab.vercel.app`
   - optional `POLAR_SERVER=sandbox` while testing
5. Polar webhook URL: `https://YOUR-DOMAIN/api/polar/webhook` (and the vercel.app URL still works if both point at this project).
6. In Polar checkout settings, allow return URLs on **both** the custom domain and `stomplab.vercel.app`.

Sign-in cookies are host-only. Paying on the custom domain returns you to that same domain. Do not leave `BETTER_AUTH_URL` stuck on vercel.app after the domain is live.

Admin: `liamjamesb09@gmail.com` at `/admin`. Polar test payments on that account still count as revenue; the free admin grant is not counted as a subscriber.

## Local

```bash
npm install
npm run dev
```
