import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP, STOMP_DEVICES } from "@/data/categories";
import { FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { TAGLINE } from "@/lib/copy";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";
import { Mark } from "./mark";

export const TUTORIAL_KEY = "stomplab.tutorial.v17";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type StepId = "what" | "rig" | "play" | "lab" | "home";

const PLAY_MODES = [
  { n: "01", t: "Snapshot", h: "Song sections. Verse, chorus, solo — as many as your unit holds." },
  { n: "02", t: "Preset", h: "Walk the bank. Next song, same box." },
  { n: "03", t: "Stomp", h: "Pedals on and off, like a board." },
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
      body: `${unit?.name ?? "Your unit"} holds ${unit?.snapshots ?? 3} snapshots and ${unit?.presets ?? 126} presets. We never invent extras. Pick the mode on the replica, then download — the file matches.`,
      cta: "Show me the Lab",
    },
    {
      id: "lab",
      title: "Type the song. Get the file.",
      body: "Two letters is enough — artwork pops up if we know it. Or skip typing and open a demo. Sandman, Teen Spirit, and Numb always work. No account.",
      cta: device.mobile ? "Next" : "Open Enter Sandman",
    },
    {
      id: "home",
      title: "Put the Lab on your home screen",
      body: device.ios
        ? "Safari only. Tap Share (square with an arrow), then Add to Home Screen. The cream SL tile is the Lab."
        : "Browser menu → Add to Home screen (or Install app). The cream SL tile is the Lab.",
      cta: "Open Enter Sandman",
    },
  ];
  const steps = device.mobile ? allSteps : allSteps.filter((s) => s.id !== "home");
  const current = steps[step];

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      setOpen(!window.localStorage.getItem(TUTORIAL_KEY));
    } catch {
      /* ignore */
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

  function openSandman() {
    const src = FEATURED.find((p) => p.id === "featured-sandman");
    const preset = src
      ? overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, stompModel), gear)
      : null;
    if (preset) savePreset(preset);
    finish();
    void navigate({ to: "/preset/$id", params: { id: preset?.id ?? "featured-sandman" } });
  }

  if (!open || !current) return null;

  const primary = () => {
    if (current.id === "home" || (current.id === "lab" && !device.mobile)) {
      openSandman();
      return;
    }
    go(step + 1);
  };

  const [first, second] = splitTagline(current.title);

  return (
    <div
      className="sl-tour fixed inset-0 z-[70] flex flex-col bg-background text-foreground"
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
          className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={finish}
        >
          Skip
        </button>
      </header>

      <div className="flex items-center gap-1.5 px-5 pt-6 sm:px-10">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              i <= step ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>

      <div key={current.id} className="sl-tour-step mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10 sm:px-10">
        <h1 id="tutorial-title" className="sl-hero-title text-[clamp(2.4rem,8vw,4.75rem)]">
          <span className="block">{first}</span>
          {second ? <span className="mt-1 block text-primary">{second}</span> : null}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{current.body}</p>

        {current.id === "what" ? (
          <ol className="sl-stagger mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", t: "Type a song", h: "Title and artist. That’s the whole brief." },
              { n: "02", t: "We research it", h: "Gear, knobs, snapshots for your unit." },
              { n: "03", t: "You import the file", h: "HX Edit or POD Go Edit → File → Import." },
            ].map((bit) => (
              <li key={bit.n} className="border-t border-border pt-4">
                <p className="font-mono text-[11px] tabular-nums tracking-[0.22em] text-pop">{bit.n}</p>
                <p className="mt-3 text-lg font-semibold tracking-tight">{bit.t}</p>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{bit.h}</p>
              </li>
            ))}
          </ol>
        ) : null}

        {current.id === "rig" ? (
          <div className="mt-10 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {(["guitar", "bass"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInstrument(id)}
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
                    onClick={() => setStompModel(d.id as StompModelId)}
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
        ) : null}

        {current.id === "play" ? (
          <ol className="sl-stagger mt-10 grid gap-6 sm:grid-cols-3">
            {PLAY_MODES.map((mode) => (
              <li key={mode.n} className="border-t border-border pt-4">
                <p className="font-mono text-[11px] tabular-nums tracking-[0.22em] text-pop">{mode.n}</p>
                <p className="mt-3 text-lg font-semibold tracking-tight">{mode.t}</p>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{mode.h}</p>
              </li>
            ))}
          </ol>
        ) : null}

        {current.id === "home" && device.mobile ? (
          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <Mark size="md" />
              <div>
                <p className="text-lg font-semibold tracking-tight">Stomp Lab</p>
                <p className="text-sm text-muted-foreground">Cream tile. Black SL. That’s the icon.</p>
              </div>
            </div>
            {device.ios ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>Tap Share in Safari (square with an arrow).</li>
                <li>Scroll to Add to Home Screen.</li>
                <li>Tap Add. The cream SL tile lands on the home screen.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>Tap the browser menu (three dots).</li>
                <li>Tap Add to Home screen or Install app.</li>
                <li>Confirm. The cream SL tile is the Lab.</li>
              </ol>
            )}
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-10">
        <Button type="button" size="lg" onClick={primary}>
          {current.cta}
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
