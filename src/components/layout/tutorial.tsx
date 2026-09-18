import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP, STOMP_DEVICES } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { TAGLINE } from "@/lib/copy";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";
import { Mark } from "./mark";

export const TUTORIAL_KEY = "stomplab.tutorial.v19";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type StepId = "what" | "rig" | "play" | "lab" | "home";
type PlayMode = (typeof PLAY_MODES)[number]["id"];

const PLAY_MODES = [
  {
    id: "snapshot",
    n: "01",
    t: "Snapshot",
    h: "Song sections. Verse, chorus, solo — as many as your unit holds. Footswitches recall whole tones.",
  },
  {
    id: "preset",
    n: "02",
    t: "Preset",
    h: "Walk the bank. Next song, same box. One file per title.",
  },
  {
    id: "stomp",
    n: "03",
    t: "Stomp",
    h: "Pedals on and off, like a board. Spare switches bypass dirt, gate, or EQ.",
  },
] as const;

const LAB_DEMOS = FEATURED.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));

const WHAT_STEPS = [
  { n: "01", t: "Type a song", h: "Title and artist. That’s the whole brief." },
  { n: "02", t: "We research it", h: "Gear, knobs, snapshots for your unit." },
  { n: "03", t: "You import the file", h: "HX Edit or POD Go Edit → File → Import." },
] as const;

function detectDevice(): { mobile: boolean; ios: boolean; android: boolean } {
  if (typeof navigator === "undefined") return { mobile: false, ios: false, android: false };
  const ua = navigator.userAgent || "";
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(ua);
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  return { mobile: ios || android || Boolean(coarse), ios, android };
}

export function Tutorial({
  force,
  onClose,
}: {
  force?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>("snapshot");
  const [labQuery, setLabQuery] = useState("");
  const [labPick, setLabPick] = useState(LAB_DEMOS[0]?.id ?? "featured-sandman");
  const [labSnap, setLabSnap] = useState(0);
  const device = useMemo(() => detectDevice(), []);
  const unit = DEVICE_MAP[stompModel];

  const allSteps: { id: StepId; title: string; body: string; cta: string }[] = [
    {
      id: "what",
      title: TAGLINE,
      body: "Stomp Lab researches the guitar or bass on a record, then writes a starting-point preset for your Line 6. You import the file. It lives on the hardware — not in a tab.",
      cta: "I have a Line 6",
    },
    {
      id: "rig",
      title: "Which box is yours?",
      body: "Guitar or bass, then the unit on your board. Every file we write is for this one — snapshots, presets, and the footswitches it actually has.",
      cta: "That's my unit",
    },
    {
      id: "play",
      title: "Three ways to play it",
      body: `${unit?.name ?? "Your unit"} holds ${unit?.snapshots ?? 3} snapshots and ${unit?.presets ?? 126} presets. Tap a mode — the switches below follow.`,
      cta: "Show me the Lab",
    },
    {
      id: "lab",
      title: "Type the song. Get the file.",
      body: "This is the Lab. Type two letters, or tap a demo. The chain, snapshots, and gear update live — same as after research.",
      cta: "Open this demo",
    },
    {
      id: "home",
      title: "Put the Lab on your home screen",
      body: device.ios
        ? "Safari only. Tap Share (square with an arrow), then Add to Home Screen. The cream SL tile is the Lab."
        : "Browser menu → Add to Home screen (or Install app). The cream SL tile is the Lab.",
      cta: "Open this demo",
    },
  ];
  const steps = device.mobile ? allSteps : allSteps.filter((s) => s.id !== "home");
  const current = steps[step];

  const labHits = useMemo(() => {
    const needle = labQuery.trim().toLowerCase();
    if (!needle) return LAB_DEMOS;
    return LAB_DEMOS.filter((p) => {
      const hay = `${p.song ?? ""} ${p.artist ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [labQuery]);

  const pickedDemo = LAB_DEMOS.find((p) => p.id === labPick) ?? labHits[0] ?? LAB_DEMOS[0];
  const preview = useMemo(() => {
    if (!pickedDemo) return null;
    return overlayUserGear(withStompModel({ ...pickedDemo, createdAt: 0 }, stompModel), gear);
  }, [pickedDemo, stompModel, gear]);

  const previewSnap = preview?.snapshots[Math.min(labSnap, Math.max(0, (preview?.snapshots.length ?? 1) - 1))];

  useLayoutEffect(() => {
    setLabSnap(0);
  }, [labPick]);

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (window.localStorage.getItem(TUTORIAL_KEY)) {
        setOpen(false);
        return;
      }
      const prior = ["v18", "v17", "v16", "v15", "v14", "v13", "v12", "v11", "v10", "v9", "v8", "v7", "v6", "v5"];
      if (prior.some((v) => window.localStorage.getItem(`stomplab.tutorial.${v}`))) {
        window.localStorage.setItem(TUTORIAL_KEY, "1");
        setOpen(false);
        return;
      }
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [force]);

  useLayoutEffect(() => {
    function replay() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(TUTORIAL_EVENT, replay);
    return () => window.removeEventListener(TUTORIAL_EVENT, replay);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("sl-touring");
    if (pathname !== "/") void navigate({ to: "/" });
    return () => document.documentElement.classList.remove("sl-touring");
  }, [open, pathname, navigate]);

  function markDone() {
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "1");
      window.localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function persist() {
    persistInstrumentUnit(instrument, stompModel);
  }

  function finish() {
    persist();
    markDone();
    setOpen(false);
    onClose?.();
  }

  function go(next: number) {
    if (next < 0) return;
    const upcoming = steps[next];
    if (!upcoming) {
      finish();
      return;
    }
    persist();
    setStep(next);
  }

  function openDemo(id?: string) {
    const src = FEATURED.find((p) => p.id === (id ?? pickedDemo?.id ?? "featured-sandman"));
    const preset = src
      ? overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, stompModel), gear)
      : null;
    if (preset) savePreset(preset);
    finish();
    void navigate({ to: "/preset/$id", params: { id: preset?.id ?? "featured-sandman" } });
  }

  if (!open || !current) return null;

  const primary = () => {
    if (current.id === "home" || current.id === "lab") {
      openDemo(pickedDemo?.id);
      return;
    }
    go(step + 1);
  };

  const [first, second] = splitTagline(current.title);
  const compact = current.id === "lab";

  return (
    <div
      className="sl-tour fixed inset-0 z-[80] flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
        <div className="flex items-center gap-3">
          <Mark size="sm" />
          <p className="sl-kicker">
            {step + 1} / {steps.length}
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 whitespace-nowrap text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={finish}
        >
          Skip
        </button>
      </header>

      <div className="flex items-center gap-1.5 px-5 pt-6 sm:px-10">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Step ${i + 1}`}
            onClick={() => go(i)}
            className={cn(
              "h-1 flex-1 rounded-full transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              i <= step ? "bg-foreground" : "bg-border",
              i === step ? "scale-y-150" : "",
            )}
          />
        ))}
      </div>

      <div
        key={current.id}
        className="sl-tour-step mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-10 sm:py-8"
      >
        <h1
          id="tutorial-title"
          className={cn(
            "sl-hero-title",
            compact ? "text-[clamp(1.7rem,4.6vw,2.6rem)]" : "text-[clamp(2.1rem,7vw,4.25rem)]",
          )}
        >
          <span className="block">{first}</span>
          {second ? <span className="mt-1 block text-primary">{second}</span> : null}
        </h1>
        <p
          className={cn(
            "max-w-2xl leading-relaxed text-muted-foreground",
            compact ? "mt-3 text-sm sm:text-base" : "mt-5 text-base sm:text-lg",
          )}
        >
          {current.body}
        </p>

        {current.id === "what" ? <WhatStep /> : null}
        {current.id === "rig" ? (
          <RigStep
            instrument={instrument}
            stompModel={stompModel}
            onInstrument={setInstrument}
            onStomp={setStompModel}
          />
        ) : null}
        {current.id === "play" ? (
          <PlayStep
            playMode={playMode}
            onPlayMode={setPlayMode}
            stompModel={stompModel}
            snapshotNames={preview?.snapshots.map((s) => s.name) ?? ["Clean", "Hello", "Chorus"]}
          />
        ) : null}
        {current.id === "lab" ? (
          <LabStep
            query={labQuery}
            onQuery={setLabQuery}
            hits={labHits.length ? labHits : LAB_DEMOS}
            pick={labPick}
            onPick={(id, song) => {
              setLabPick(id);
              setLabQuery(song);
            }}
            preview={preview}
            snapIndex={labSnap}
            onSnap={setLabSnap}
            previewSnap={previewSnap}
            unitShort={unit?.short ?? "HX"}
          />
        ) : null}
        {current.id === "home" && device.mobile ? <HomeStep ios={device.ios} /> : null}
      </div>

      <footer className="flex flex-wrap items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-10">
        <Button type="button" size="lg" onClick={primary}>
          {current.id === "lab" || current.id === "home"
            ? `Open ${pickedDemo?.song ?? "Enter Sandman"}`
            : current.cta}
        </Button>
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => go(step - 1)}>
            Back
          </Button>
        ) : null}
      </footer>
    </div>
  );
}

function WhatStep() {
  return (
    <div className="mt-8 grid flex-1 gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <ol className="sl-stagger grid gap-3 sm:grid-cols-3">
        {WHAT_STEPS.map((bit) => (
          <li key={bit.n} className="flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[11px] tabular-nums tracking-[0.22em] text-pop">{bit.n}</p>
            <div>
              <p className="text-lg font-semibold tracking-tight">{bit.t}</p>
              <p className="mt-2 text-sm leading-snug text-muted-foreground">{bit.h}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex min-h-44 flex-col justify-between rounded-2xl border border-border bg-card p-5">
        <p className="sl-kicker">The product is a file</p>
        <div className="mt-6 flex items-center gap-4">
          <Mark size="lg" />
          <div className="min-w-0">
            <p className="font-mono text-sm tracking-tight">EnterSandman.hlx</p>
            <p className="mt-1 text-xs text-muted-foreground">HX Edit → File → Import Setlist / Preset</p>
          </div>
        </div>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          It lives on the hardware. Close the tab. The rig is still on the box.
        </p>
      </div>
    </div>
  );
}

function RigStep({
  instrument,
  stompModel,
  onInstrument,
  onStomp,
}: {
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  onInstrument: (id: "guitar" | "bass") => void;
  onStomp: (id: StompModelId) => void;
}) {
  const unit = DEVICE_MAP[stompModel];
  const switches = unit?.footswitches ?? 3;
  return (
    <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {(["guitar", "bass"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onInstrument(id)}
              className={cn(
                "min-h-16 rounded-2xl border px-5 py-4 text-left text-xl font-semibold capitalize tracking-tight transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                instrument === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STOMP_DEVICES.map((d) => {
            const on = stompModel === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onStomp(d.id as StompModelId)}
                className={cn(
                  "min-h-16 rounded-2xl border px-4 py-4 text-left transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                )}
              >
                <span className="block text-base font-semibold tracking-tight">{d.short}</span>
                <span className={cn("mt-1 block text-xs", on ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {d.snapshots} snaps · {d.presets} presets
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="sl-kicker">{unit?.name ?? "HX Stomp"}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {switches} footswitches · {unit?.snapshots ?? 3} snapshots · {unit?.maxBlocks ?? 8} blocks. We never invent extras this box cannot hold.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {Array.from({ length: Math.min(switches, 8) }).map((_, i) => (
            <span
              key={i}
              className="grid aspect-square place-items-center rounded-full border border-border bg-secondary font-mono text-[10px] tabular-nums text-muted-foreground"
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayStep({
  playMode,
  onPlayMode,
  stompModel,
  snapshotNames,
}: {
  playMode: PlayMode;
  onPlayMode: (id: PlayMode) => void;
  stompModel: StompModelId;
  snapshotNames: string[];
}) {
  const unit = DEVICE_MAP[stompModel];
  const n = unit?.footswitches ?? 3;
  const labels = switchLabels(playMode, n, snapshotNames);
  return (
    <div className="mt-8 flex flex-1 flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {PLAY_MODES.map((mode) => {
          const on = playMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onPlayMode(mode.id)}
              className={cn(
                "min-h-24 rounded-2xl border px-4 py-5 text-left transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
              )}
            >
              <p className={cn("font-mono text-[11px] tabular-nums tracking-[0.22em]", on ? "text-primary-foreground/80" : "text-pop")}>
                {mode.n}
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">{mode.t}</p>
            </button>
          );
        })}
      </div>
      <div className="flex flex-1 flex-col justify-between rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="sl-kicker">{unit?.short ?? "Stomp"} · {playMode}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {PLAY_MODES.find((m) => m.id === playMode)?.h} Tap a switch below — that is how the file lands on the box.
            </p>
          </div>
        </div>
        <div className={cn("mt-8 grid gap-3", n > 4 ? "grid-cols-4" : "grid-cols-3")}>
          {labels.map((sw) => (
            <div key={sw.i} className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "grid size-16 place-items-center rounded-full border text-[11px] font-semibold tracking-tight transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] sm:size-20",
                  sw.on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground",
                )}
              >
                {sw.i + 1}
              </span>
              <span className="max-w-20 truncate text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {sw.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function switchLabels(mode: PlayMode, n: number, snapshots: string[]) {
  return Array.from({ length: Math.min(n, 8) }).map((_, i) => {
    if (mode === "snapshot") {
      const name = snapshots[i];
      return { i, label: name ? name.slice(0, 8) : i === n - 1 ? "TAP" : "—", on: Boolean(name) };
    }
    if (mode === "preset") {
      return { i, label: i === 0 ? "PREV" : i === 1 ? "NEXT" : i === n - 1 ? "TAP" : "FS", on: i < 2 };
    }
    const stomps = ["DRIVE", "GATE", "EQ", "MOD", "DLY", "RVB", "WAH", "BOOST"];
    return { i, label: i === n - 1 ? "TAP" : stomps[i] ?? "FS", on: i < 3 && i !== n - 1 };
  });
}

function LabStep({
  query,
  onQuery,
  hits,
  pick,
  onPick,
  preview,
  snapIndex,
  onSnap,
  previewSnap,
  unitShort,
}: {
  query: string;
  onQuery: (v: string) => void;
  hits: typeof LAB_DEMOS;
  pick: string;
  onPick: (id: string, song: string) => void;
  preview: ReturnType<typeof overlayUserGear> | null;
  snapIndex: number;
  onSnap: (i: number) => void;
  previewSnap: { id: string; name: string; color: string; enabledBlocks: string[]; notes: string } | undefined;
  unitShort: string;
}) {
  const enabled = new Set(previewSnap?.enabledBlocks ?? []);
  return (
    <div className="mt-6 flex flex-1 flex-col gap-5">
      <label className="block">
        <span className="sr-only">Type a song</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Type a song — Sandman, Teen Spirit…"
          className="h-14 w-full rounded-2xl border border-border bg-card px-5 text-base outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
          autoComplete="off"
        />
      </label>
      <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="order-2 space-y-2 lg:order-1">
        <ul className="grid gap-2">
          {hits.map((p) => {
            const on = pick === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id, p.song ?? "")}
                  className={cn(
                    "flex min-h-20 w-full flex-col justify-center rounded-2xl border px-4 py-3 text-left transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  <span className={cn("text-[10px] uppercase tracking-[0.16em]", on ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {p.artist}
                  </span>
                  <span className="mt-1 text-lg font-semibold leading-tight tracking-tight">{p.song}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {preview ? (
        <div className="order-1 flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 lg:order-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="sl-kicker">What you get</p>
              <p className="mt-2 text-xl font-semibold tracking-tight">
                {preview.song} — .{preview.stompModel === "pod-go" ? "pgp" : "hlx"} for {unitShort}
              </p>
            </div>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">{preview.tempo} BPM</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{preview.summary}</p>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Signal path</p>
            <ol className="mt-2 flex flex-wrap gap-2">
              {preview.blocks
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((b) => {
                  const model = MODEL_MAP[b.modelId];
                  const on = enabled.size ? enabled.has(b.id) : b.enabled;
                  return (
                    <li
                      key={b.id}
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-tight",
                        on
                          ? "border-border bg-secondary text-foreground"
                          : "border-transparent text-muted-foreground line-through",
                      )}
                    >
                      {model?.abbrev ?? model?.name ?? b.modelId}
                    </li>
                  );
                })}
            </ol>
          </div>

          {preview.snapshots.length ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Snapshots — tap one</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.snapshots.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSnap(i)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                      i === snapIndex
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground",
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {previewSnap?.notes ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{previewSnap.notes}</p>
              ) : null}
            </div>
          ) : null}

          {preview.originalGear.length ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Grab this</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {preview.originalGear.slice(0, 6).map((g) => (
                  <li key={`${g.role}-${g.name}`} className="min-w-0 rounded-xl bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.role}</p>
                    <p className="truncate text-sm font-medium">{g.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function HomeStep({ ios }: { ios: boolean }) {
  return (
    <div className="mt-8 grid flex-1 gap-5 lg:grid-cols-[minmax(0,16rem)_1fr]">
      <div className="mx-auto w-full max-w-[16rem] rounded-[2rem] border border-border bg-card p-4">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Home screen</p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) =>
            i === 0 ? (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Mark size="sm" />
                <span className="text-[9px] text-muted-foreground">Stomp Lab</span>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="size-10 rounded-[22%] bg-secondary" />
                <span className="h-2 w-8 rounded-full bg-secondary" />
              </div>
            ),
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
          <Mark size="lg" />
          <div>
            <p className="text-lg font-semibold tracking-tight">Stomp Lab</p>
            <p className="text-sm text-muted-foreground">Cream tile. Black SL. That’s the icon.</p>
          </div>
        </div>
        {ios ? (
          <ol className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-mono text-[11px] text-pop">01</span>
              <span className="ml-3">Tap Share in Safari (square with an arrow).</span>
            </li>
            <li className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-mono text-[11px] text-pop">02</span>
              <span className="ml-3">Scroll to Add to Home Screen.</span>
            </li>
            <li className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-mono text-[11px] text-pop">03</span>
              <span className="ml-3">Tap Add. The cream SL tile lands on the home screen.</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-mono text-[11px] text-pop">01</span>
              <span className="ml-3">Tap the browser menu (three dots).</span>
            </li>
            <li className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-mono text-[11px] text-pop">02</span>
              <span className="ml-3">Tap Add to Home screen or Install app.</span>
            </li>
            <li className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-mono text-[11px] text-pop">03</span>
              <span className="ml-3">Confirm. The cream SL tile is the Lab.</span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

function splitTagline(title: string): [string, string] {
  const idx = title.indexOf(". ");
  if (idx > 0) return [title.slice(0, idx + 1), title.slice(idx + 2)];
  return [title, ""];
}

export function replayTutorial() {
  try {
    window.localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TUTORIAL_EVENT));
}
