# Stomp Lab

Research a song. Get a Line 6 HX Stomp, Helix, HX Effects, or POD Go preset you can import.

Stomp Lab maps a recorded guitar or bass part onto your unit: signal path, knobs, snapshots, footswitches, and a factory-safe `.hlx` or `.pgp` file.

## What you do

1. Open a demo (Enter Sandman, Smells Like Teen Spirit, Comfortably Numb). Demos stay free.
2. Sign in with email. 3 free custom builds after you sign in. Then subscribe: **$6.99/month** or **$75/year** (50 custom builds a month).
3. Download `.hlx` into HX Edit, or `.pgp` into POD Go Edit. Put the unit in Snapshot mode so the numbered switches recall the tones.

Featured demos never count as a build. A repeated build of the same song still counts. Questions: the support address on the site.

## Stack

- TanStack Start + React 19 + Tailwind v4
- Auth: Better Auth email/password
- Shared cache + entitlements: Postgres
- Gemini for research
- Polar checkout (merchant of record)

## Deploy

1. Push this repo to GitHub and attach it to the production host.
2. Attach the custom domain as the production domain.
3. Set `DATABASE_URL` for Postgres.
4. Set on the host: `APP_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, a Gemini key, and the Polar token, product ids, and webhook secret.
5. Point the Polar webhook at `https://YOUR-DOMAIN/api/polar/webhook`.
6. Allow the custom domain as a Polar checkout return URL.

Sign-in cookies are host-only. Paying on the custom domain returns you to that same domain.

The database schema is applied when the server starts. It is not part of the site build.

## Local

```bash
npm install
npm run dev
```
