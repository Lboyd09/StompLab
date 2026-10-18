# Stomp Lab — context for whoever builds next

This file is the product contract. Read it before changing the app.

`AGENTS.md` is the Grok app-builder sandbox (port 8080, preview chrome, “don’t mention localhost”). If you are Claude Code on a normal checkout of this repo, ignore that sandbox contract. Do not delete `AGENTS.md`. Do not spend product time on `public/__grok/`, `scripts/grok-pwa-*`, or `server/middleware/grok-pwa.ts`. Those are builder chrome.

## What this app is

Stomp Lab (stomplab.app) researches a recorded guitar or bass part and builds a preset the player can import into a real Line 6 unit.

Units: HX Stomp, HX Stomp XL, Helix Floor, Helix LT, HX Effects (pedals only — no amp or cab), POD Go (`.pgp`, not `.hlx`).

The player types a song, picks a unit, and gets a signal path, knobs, snapshots, footswitches, and a factory-safe file. HX Edit imports `.hlx`. POD Go Edit imports `.pgp`. The unit has to be in Snapshot mode for the numbered switches to recall the tones.

Presets are unofficial starting points. They are not a copy of the record, not a commercial pack, and not affiliated with Line 6 or Yamaha. Say that once on a page. Do not write copy that sounds like a changelog.

Tagline, already in `src/lib/copy.ts`: “Type a song. Get that guitar rig.”

## Who you are working for

Liam owns the product. He plays guitar (including worship), and he hears the result on hardware. A preset that typechecks and exports can still be wrong if the intro is dimed, the gate is closed, the chorus model is the wrong Boss pedal, or the tempo is 120 because the example JSON said 120.

He judges the app as a player, then as the person who has to ship it. Accuracy beats a fast diff. “Efficient” that skips the listen-check is a bug.

He is not your deploy engineer. When the work is done, commit the product files and push `main` to https://github.com/Lboyd09/StompLab.git without being asked. Production is Vercel, attached to that repo, domain `stomplab.app` (www redirects). Do not claim a Vercel deploy happened unless you actually created one. A GitHub push is what this workflow can guarantee.

Git author already on the repo: `Stomp Lab <stomplab1@gmail.com>`. Do not change `git config`. Do not commit screenshots, `.grok/`, `AGENTS.project.md`, `attachments/`, or untracked auth experiments (`src/lib/auth/sign-in-gate.ts`, `gate-session-marker.ts`, `src/lib/env.server.ts`) unless he asked for that file.

## How he talks, and how you should answer

He writes like a person, not a ticket. Short when he wants an action (“Push.” “It failed to upload.”). Long and ordered when he wants an audit. Match that.

- Do the work, then say what changed. Do not open with a plan and wait.
- If he gives a list, answer with a fixed / not-fixed table and a one-line reason for each item. Do not mark something fixed because the code “should” do it.
- If he says you still didn’t, he already checked. Look again. Don’t restate the last summary.
- No emoji. No “certainly”. No recap of who he is. No lecture.
- Player-facing copy is short and concrete. Never “Re-download, a closed gate was muting snapshots.” Never “0 free songs” or “unlimited” for a normal account.
- Don’t ask him to open localhost, run a command, or paste a log. You run the checks.
- Don’t mention the sandbox, ports, or tool names in anything he reads.
- When something cannot be fixed in the repo, say that in one sentence and name the switch he has to flip. Don’t invent a code workaround that pretends it’s fixed.

He reviews on an iPhone, about 390px wide. If the bottom nav covers the button, the field overflows, or two labels overlap on the little LCD, it is broken.

## Where the app is (17 Oct 2026)

Latest product commit on `main`: `dddb77c` — “Reject unknown songs, finish tones from the record, and clean admin and copy.” Pull before you edit. Parent of that is `4b590ad`, which moved `@tanstack/react-start` to ~1.168.60 so Vercel would accept the publish (CVE-2026-102989; anything below 1.168.60 is refused).

Stack: TanStack Start, React 19, Vite 8, Nitro on Vercel, Tailwind v4, Better Auth (email/password), Postgres (PGLite locally), Polar (merchant of record), Gemini 2.5 Flash for research. Package name is `stomp-lab`.

`npm run build` is `vite build` only. On local PGLite every migration applies when the server starts (`src/lib/db.ts`). On Postgres the server only runs the idempotent security DDL in `src/lib/schema-ensure.ts` (migrations 0014–0019) before its first query; any other new migration needs `npm run db:migrate` — keep `schema-ensure.ts` in step with new security migrations. Do not put `db:migrate` back on the build. `npm run db:migrate` still exists for a manual run.

Prices, in `src/lib/plan.ts`: $6.99/month, $75/year. Launch promo is 20% off the first monthly invoice only. Yearly stays $75. Invite from a paying monthly account is 50% off one monthly invoice for both sides, plus 3 extra custom builds. Free invite is 3 extra custom builds only. Cap is 3 friends. New account, first 48 hours, before that account has researched a song.

Plan caps: `FREE_BUILDS = 3`, `PAID_MONTHLY_BUILDS = 50`. Demos never count. A repeated custom build of the same song still counts. Admin accounts have no monthly cap. Everyone else uses the sentences in `src/lib/copy.ts`:

- `FREE_BUILD_LINE` — “3 free custom builds after you sign in. Demos stay free.”
- `PAID_BUILD_LINE` — “50 custom builds a month.”

Import those. Don’t invent a third wording.

### What just shipped in `dddb77c`

- A song is confirmed on iTunes before cache, Gemini, or `recordBuild`. Unknown, fake, or mash titles return `SONG_NOT_FOUND` (“We couldn't find that song. Check the title and artist, or open a demo.”). They are not cached and not counted. Featured demos still return from the library before that check.
- Build stays disabled until a suggestion is picked or `looksLikeRealSong` passes. A grammatical fake (“The Quantum Refrigerator at 3AM”) can still be submitted. The server rejects it. That is intentional.
- Tempo comes from a small BPM lookup. `finishTone` overwrites the preset tempo when BPM is 40–240. The JSON example tempo is 96, not 120, so the model is not taught “always 120”. If the lookup fails, nothing forces 120.
- Generated presets get a noise gate (threshold about 1.6–1.8 on a 0–10 knob) in front of a high-gain amp or a drive, off on clean/intro snapshots. A delay with no Time and no Note gets Note 8 (dotted eighth, tempo-synced); a Time the model chose stays free-running. Lead delay mix ≤ 2.5 and feedback ≤ 3.5. Time is never left at 10. A lead/solo snapshot gets a Kinky Boost (its Boost switch on — the model has no output knob), not a tiny channel-volume nudge. Clean snapshots drop dirt and the gate and keep amp drive low.
- Snapshot names fit 12 characters by abbreviating whole words first (`RHYTHM CRUNCH` → `Rhy Crnch`). Do not slice mid-word. The abbrev regexes must not use the `g` flag (`lastIndex` sticks).
- Gemini uses a response schema, retries once on bad JSON, and never shows a raw parse error (“Expected ',' or ']'…”). The player sees “We couldn't read that preset. Try that song again.”
- History dedupes by song + unit (or custom name + unit), newest first, cap 400. Same song and unit reuses the v11 cache instead of a new Gemini call. The repeat still counts as a build.
- Catalog is paged (48). Empty search params are stripped. Find equivalent: TS808 scores 100, the title is the Line 6 model name, and an unknown pedal says there is no match. Studio albums rank above compilations (STP “Plush” → Core, not Thank You).
- Gear brands merged: LTD and ESP LTD → ESP, Sterling → Sterling by Music Man, Tom Anderson → Anderson. One Gibson Les Paul Standard.
- Admin: emails masked, accounts paged, timestamps local, no database host, no env-var names, no “key is set” lines. Erase is `/admin/erase` (email twice, then DELETE). `/admin/users` redirects to `/admin`. The Polar test-cancel button is `import.meta.env.DEV` only. Stats are labeled by window: signups exclude the owner inbox, “builds this month” is this calendar month, the Builds table is one row per player per month for ~100 days, History is this device.
- Visit beacon skips `/admin` and owner emails.
- Signed-in users no longer see “Checking your account…” or a create-account pitch while auth is settling.
- Copy JSON sits behind Advanced. Settings says “Saved”. Terms and Privacy link each other, Polar’s terms, and the Gemini API terms.
- Subscribe (`/upgrade`) uses the normal header and bottom nav.

### Not fixed, and not a code bug you can pretend away

stomplab.app was still returning Vercel’s security checkpoint (`429`, `x-vercel-mitigated: challenge`) to ordinary browser clients and to Slack/Twitter link-preview bots. That switch lives in the Vercel firewall (Attack Challenge Mode), not in this repo. Link-preview bots cannot pass a JavaScript challenge. Turn the challenge off, or allow those bots, in the Vercel project.

`scripts/list-junk-cache.mjs` only lists junk cache rows (Quantum Refrigerator, Paper Lanterns of Mars, keyboard mash, and similar). It does not delete. Do not run it unless Liam asks. With no `DATABASE_URL` it prints SQL and exits.

## How a song becomes a preset

`researchSongFn` in `src/lib/research.ts`, in this order:

1. Featured library, before song confirmation and before the paywall. Demos (`DEMO_IDS`: Sandman, Teen Spirit, Numb) are free for everyone. Other featured rigs (including Higher) are served to paid players. The guitar role plays no part: a featured preset is served whole (`libraryServesFeatured` in `src/lib/guitar-role.ts`).
2. Plan and quota (`canResearch`). Free exhaustion is the paywall message. Paid exhaustion is “this month’s 50 custom builds”.
3. Rate limit.
4. `confirmReleasedSong` (`src/lib/song-verify.ts` → iTunes, fail closed).
5. Cache key `song|v11|…` including unit, instrument, playback, wah, and guitar role. The role is decided on the server (`songBuildRole`): `lead` for a song `guitarArrangement` knows has two guitar parts, `both` for everything else and for bass. The client’s `guitarRole` is ignored. So one-guitarist rows (`|both`) and earlier lead builds (`|lead`) still hit; `|rhythm` rows are orphaned. SQL fallback is `song|v11|%|role` and the same `stomp_model`. Do not bump to v12 unless you mean to throw away every cached song.
6. Two Gemini calls. Step 1 (`geminiGroundedNotes`, Google key only, Google Search grounding, 30 s, fail-soft) returns a short fact sheet: tempo, tuning, guitarist, guitar/pickup, amp and settings, pedals, delay/reverb, per-section tone. 2.5 Flash cannot ground and return a JSON schema in the same call, so step 1 is plain text read by `parseRecordNotes`. Its BPM is the tempo; `lookupBpm` runs only when step 1 has none. Step 2 is the structured preset call with those notes in the prompt. Then `recordBuild`, then persist. `recordBuild` only after a real preset exists.

`finishPreset` is wah + the player’s gear overlay + `finishTone(bpm)` + `sanitizeSnapshots`.

`finishTone` (`src/lib/tone-finish.ts`) reshapes generated presets only. If `source === "featured"`, it may set tempo and then returns. Do not run the shaper on the hand-built demos. Fix a demo in `src/data/featured.ts`. It also level-matches generated snapshots on the amp’s Ch Vol (`levelMatch`: clean and riff level, a solo about +2.5 dB, moves capped, never below 3.2). A tuning other than E standard becomes the first tip (“Tune down a half step (Eb standard)”); no pitch block is added.

`createCustomSoundFn` is not a song. It does not confirm a title and does not take a BPM. Create is paid.

`revisePresetFn` runs `sanitizeSnapshots(finishTone(preset))` without a BPM.

Standing prompt rules live in `src/lib/preset-schema.ts` and `src/lib/research-lessons.ts`. Lessons must not name a featured song title. Feedback does not retune one named demo; Liam asks for those by hand.

## Tone rules you will get wrong if you guess

Knobs in the UI and in preset JSON are 0–10, except whole-number knobs (Note, Mic, Interval, Mode, Clipping), which carry their real setting. Export maps them onto HX ranges in `src/lib/hx-units.ts` using HX Edit’s own catalog (`src/data/hx-catalog.ts`). Do not write HX native numbers for 0–10 knobs. Knob names can be the HX Edit labels (Gain, Tone) or the older app names (Drive, Treble); `src/lib/hx-params.ts` resolves both. A knob left out keeps Line 6’s factory default.

HX Stomp holds 8 blocks. A gate after the cab, or a threshold hotter than about 2.2, mutes the snapshot. That muted Sandman. Never add `hard-gate`. The gate block is `noise-gate`. Its threshold stays open (about 1.6–2.2). Clean and intro snapshots bypass it. Level on that block is unity in the exporter; don’t “fix” loudness with it.

Amp and cab stay on in every snapshot. Channel volume, output, level, and master stay at or above ~3.2 or the snapshot goes silent.

Stand-ins, use these ids:

| Real gear | Model id | Not this |
|---|---|---|
| BOSS DS-1 | `deez-one-vintage` | `stupor-od` (that is the SD-1) |
| BOSS SD-1 | `stupor-od` | `deez-one-vintage` |
| Ibanez TS808 / TS9 | `scream-808` | |
| BOSS CE-2 | `chorus` | `70s-chorus` (that is CE-1 / Small Clone) |
| BOSS CE-1, EHX Small Clone | `70s-chorus` | `chorus` |
| Binson Echorec | `echo-platter-legacy` | `cosmos-echo` |
| Roland RE-201 Space Echo | `cosmos-echo` | Echo Platter |
| Mesa Dual Rectifier | `cali-rectifire` | |
| Xotic EP Booster | `kinky-boost` | a channel-volume nudge |
| Mesa 5-band graphic | `cali-q-graphic` | |
| Noise gate | `noise-gate` | `hard-gate` |

Unsourced gear notes start with `Likely —`. Don’t add that prefix twice.

Tempo sync is the `Note` knob on a delay: 8 = dotted eighth, 6 = quarter, 9 = eighth (HX `TempoSync1` + `SyncSelect1`). Older presets stored `Scale: 5` for the dotted eighth; the exporter still reads that. Delay `Scale` is otherwise a stereo control. Lead mix ≤ 2.5, feedback ≤ 3.5.

Snapshot names: 12 characters in the `.hlx`. `fitSnapshotName` abbreviates every word, then cuts. `sanitizeLabel` in `src/lib/hlx.ts` still slices to 12; names should already fit.

## The demos, as they are supposed to sound

Homepage trio only: Enter Sandman, Smells Like Teen Spirit, Comfortably Numb. Higher is in the featured library and is not on that trio.

- **Teen Spirit.** Clean, then Verse (DS-1, `deez-one-vintage`), then Hello (a light chorus). No noise gate. Solo shares Hello. Don’t add a fourth “solo” snapshot.
- **Sandman.** Intro is amp and cab, drive about 0.6, gate bypassed. Rhythm is the Tube Screamer, gate on, the graphic scoop, no boost, no delay. Lead turns the scoop off, turns the boost on (output ~7), and turns on a restrained delay (mix ~2.2, feedback ~3.0, scale 5). Do not raise amp drive for the lead. On XL the spare switches are GATE and EQ.
- **Comfortably Numb.** The delay in the chain is Echo Platter (the Helix Binson), in front of the amp. The copy says Echorec. It must not say Cosmos Echo and then load a different model.
- **Higher** (Creed, Human Clay, tempo 78). Verse clean with chorus (drive ~1.6, gate and boost off). Chorus heavy (drive ~5.4, gate on, chorus pedal off). The lift is the boost output, not more drive. The CE-2 note is marked likely.

A looked-up guitar song is always the LEAD guitarist’s part across the whole song (owner decision): that player’s intro, verse, chorus, and solo tones as snapshots. Never the rhythm player’s part, never a blend of two players. One-guitarist songs build that guitarist. Bass is unchanged. There is no rhythm/lead picker; the server ignores a `guitarRole` sent by an older client. Snapshots are named by song section (Intro, Verse, Chorus, Solo); `Clean` only in a clean snapshot’s name (that is what `finishTone` cleans up), `Solo`/`Lead` only on the solo (that is what gets the boost).

## Map

| Area | Where |
|---|---|
| Pages | `src/routes/` — file routes. `src/routeTree.gen.ts` is generated. Don’t hand-edit it unless the generator hasn’t run; a new page needs the tree or `Link` fails typecheck. |
| Shell | `src/routes/__root.tsx`, `src/components/layout/app-shell.tsx`. Bare routes (no shell): `/login`, `/reset-password`, `/goodbye`. `/upgrade` stays in the shell. |
| Home / build | `src/routes/index.tsx`, `song-typeahead.tsx` (suggestions are in the document flow, not an absolute menu over the button) |
| Preset screen | `src/components/preset/preset-workspace.tsx`, `src/components/stomp/` |
| Export | `src/lib/hlx.ts` (HX units), `src/lib/pgp.ts` (POD Go’s ten-slot layout), `src/lib/hx-params.ts` (knob names → HX keys), `src/lib/hx-units.ts` (0–10 ↔ native), `src/lib/hx-validate.ts` (checks a file against the catalogs). Per-unit device id, I/O models and snapshot controller live on `STOMP_DEVICES` in `src/data/categories.ts`, taken from real exports. |
| HX / POD Go model catalogs | `src/data/hx-catalog.gen.ts`, `src/data/podgo-catalog.gen.ts` — generated by `scripts/build-hx-catalog.mjs` / `scripts/build-podgo-catalog.mjs`; licence in `src/data/HX_CATALOG_NOTICE.md`. Don’t hand-edit. |
| Catalog | `src/data/catalog.ts`, `models-*.ts`, `helix-ids.ts`, `helix-params.ts`. Find-equivalent scores are `findEquivalents`. |
| Player’s gear | `src/data/gear-catalog.ts`. Brand fold is `canonicalBrand` inside `expand()`. `popularFor` matches the full display name (`ESP LTD EC-1000` is brand ESP + model “LTD EC-1000”). |
| Plan, paywall, admin data | `src/lib/plan.ts`, `src/lib/billing.ts`, `src/lib/use-plan.ts` |
| Admin UI | `src/routes/admin.tsx`. Child routes only render if the path is not `/admin`, because the dashboard returns `<Outlet />` first. If you add `admin.something.tsx`, keep that. A file named `admin_.erase.tsx` would be a non-nested route instead. |
| Auth | `src/lib/auth/`. Server functions use `authMiddleware`. Never trust a user id sent from the client. |
| Billing | `src/lib/polar.ts`, `src/routes/api/polar.webhook.ts` |
| Local history | `src/lib/storage.ts` (`historyKey`, `dedupeHistory`) |
| Copy | `src/lib/copy.ts`, `src/lib/legal.ts` |

`/admin` unlocks only for the business inbox in `adminEmails()` inside `plan.ts`. Owner inboxes are excluded from revenue and from the player list. Do not print those addresses in the README, the admin UI, or a status page. Do not show whether an API key or env var is configured.

## Tests and checks

`package.json` `"test"` is an explicit file list. A new test file does not run until you add it there. Files that import `@/` need the third group: `node --experimental-strip-types --import ./scripts/register-alias.mjs --test …`.

Before you say it’s done: `npm run typecheck` and `npm run build`. Run the tests you touched, and the full `npm test` when the change is in the preset, export, catalog, or plan path.

Export tests in `src/lib/hlx.test.ts` are the listen-check we can automate: no blank snapshot, no muted level, Sandman’s intro gate off and rhythm gate on, Teen Spirit has no gate, every featured preset exports on every unit. If you change a demo, update the test to the sound you intend, not the other way around.

`noUnusedLocals` is off. Don’t leave dead state anyway.

## Working rules

- Fix the thing he asked. Don’t refactor the neighborhood.
- Don’t add a second source of truth for price, plan caps, or model stand-ins.
- Don’t cache or count a build for a song iTunes did not confirm.
- Don’t reshape featured demos inside `finishTone`.
- Don’t bump the cache version to hide a bug `finishTone` can correct on the way out.
- Don’t show raw model ids, SQL, env names, or JSON parser output to a player.
- A knob the player turned stays turned (`userEdited`). Don’t overwrite it on the next render.
- Mobile first for any control on the home, create, preset, account, or catalog screen.
- Commit only the product. Push `main` when the checks pass.

If he says the new version is not on GitHub, he means this remote, not your last chat message. If he says it failed to upload, check the Vercel / TanStack error before assuming the push didn’t happen. The last publish failure was the old TanStack version, and that commit is already on `main`.
