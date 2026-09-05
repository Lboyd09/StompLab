# Stomp Lab

Research a song. Get a Line 6 HX Stomp (or POD Go) preset you can import.

Stomp Lab maps recorded/live guitar and bass rigs onto HX Stomp / XL / Helix / HX Effects / POD Go: signal path, knobs, snapshots, footswitches, and a factory-safe `.hlx` or `.pgp` file.

## What visitors do

1. Open a demo (Enter Sandman, Smells Like Teen Spirit, Comfortably Numb) — always free, always downloadable.
2. Sign in with email. Three custom songs are free. Then subscribe: **$6.99/month** or **$75/year** via Polar (50 custom builds a month).
3. Download `.hlx` → HX Edit → File → Import, or `.pgp` → POD Go Edit. Put the unit in **Snapshot mode** so the numbered switches recall intro / verse / chorus.

Cache hits still count as a build. Users never see a shared library. Featured demos never count. Other known rigs are replica-only until subscribe. Admin is `stomplab1@gmail.com` at `/admin` (not in the nav). Support: `stomplab1@gmail.com`.

## Stack

- TanStack Start + React 19 + Tailwind v4
- Auth: Better Auth email/password
- Shared cache + entitlements: Postgres (Supabase in production, PGLite in local preview)
- Gemini 2.5 Flash
- Polar checkout (merchant of record)
- Amazon Associates for original-gear shop links (`VITE_AMAZON_ASSOCIATE_TAG`)

## Deploy

1. Push this repo to GitHub and attach it to the production host.
2. Attach the **custom domain** as the production domain (`stomplab.app`).
3. Postgres is attached as `DATABASE_URL` (Supabase session pooler on port 5432 is the safest for Better Auth; transaction pooler 6543 also works).
4. Set on the host:
   - `APP_ORIGIN=https://YOUR-DOMAIN` (the domain you bought — no trailing slash)
   - `BETTER_AUTH_URL=https://YOUR-DOMAIN` (same value)
   - `BETTER_AUTH_SECRET` (long random string — keep it stable or sessions reset)
   - `AI_GATEWAY_API_KEY` for Gemini
   - `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID_MONTHLY`, `POLAR_PRODUCT_ID_YEARLY`, `POLAR_WEBHOOK_SECRET`
   - `VITE_AMAZON_ASSOCIATE_TAG` (do not invent this — paste the real Store ID)
   - optional `CRON_SECRET` (daily keep-alive at `/api/keepalive` so free Supabase does not pause)
   - optional `POLAR_ORG_SLUG` or `POLAR_PORTAL_URL` if the Polar customer portal needs a fallback
   - optional `EXTRA_AUTH_HOSTS=www.YOUR-DOMAIN`
   - optional `POLAR_SERVER=sandbox` while testing
5. Polar webhook URL: `https://YOUR-DOMAIN/api/polar/webhook`.
6. In Polar checkout settings, allow return URLs on the custom domain.

Sign-in cookies are host-only. Paying on the custom domain returns you to that same domain.

Admin: `stomplab1@gmail.com` at `/admin`. Polar tests from owner inboxes (`stomplab1@gmail.com` and the personal Gmail) are hidden from revenue and subscriber counts. The free admin grant is not counted as a subscriber.

## Local

```bash
npm install
npm run dev
```
