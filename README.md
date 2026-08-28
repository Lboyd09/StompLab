# Stomp Lab

Research a song. Get a Line 6 HX Stomp preset you can import in HX Edit.

Stomp Lab maps recorded/live guitar and bass rigs onto the HX Stomp / HX Stomp XL: signal path, knobs, snapshots, footswitches, and a `.hlx` file.

## What visitors do

1. Open a featured song (Teen Spirit, Enter Sandman, …) — no API key.
2. Or paste a [free Gemini API key](https://aistudio.google.com/apikey) in Settings and research any other track.
3. Download `.hlx` → HX Edit → File → Import. Put the unit in **Snapshot mode** so FS1–FS3 recall verse / chorus / solo.

The first person to research a new song stores the public preset (song, artist, HX path only) in a shared library. Repeats skip Gemini. API keys, gear lockers, and history stay in the browser. They are never written to the database.

## Stack

- TanStack Start + React 19 + Tailwind v4
- Shared cache: Postgres (Neon in production, PGLite in local preview)
- Gemini 3.7 Flash via the visitor’s own key (no server-side secret)

Auth is off. The cache table is unowned public song data only.

## Deploy (GitHub → Vercel)

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add a Neon Postgres database and set `DATABASE_URL` on the project.
4. Deploy. Do not set an xAI or Gemini key on the server — visitors paste their own Gemini key in Settings.

`VITE_AUTH_ENABLED` must stay `false`.

Visitors should create an **unrestricted** AI Studio key (no HTTP-referrer lock). Subscriptions / a shared API key can be added later; this deploy does not need them.

## Local

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
```

## HX Edit notes

- Device: HX Stomp (`2162694`) or HX Stomp XL (`2162699`)
- Firmware target: 3.80
- After import, PAGE until the scribble strips show snapshot names (VERSE / CHORUS / …)
- Model IDs are factory HD2_* names (e.g. `HD2_AmpCaliIVR2`, `HD2_DistRamsHead`, `HD2_Cab4X12CaliV30`). Helix Stadium `Agoura_` / `CabMicIr_` / `HX2_` names are not used.
- If HX Edit says “unrecognized models”, the unit firmware is older than a model in the preset — update HX Edit / firmware to 3.80+
