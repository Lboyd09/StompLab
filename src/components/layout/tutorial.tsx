import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { STOMP_DEVICES } from "@/data/categories";
import { FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";
import { Mark } from "./mark";
import { LedStrip, MiniStomp, SignalPath } from "./signal-path";

export const TUTORIAL_KEY = "stomplab.tutorial.v13";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type StepId = "what" | "rig" | "snaps" | "song" | "demo" | "home";

const SPOTLIGHT: Partial<Record<StepId, string>> = {
  song: "#lab-form",
  demo: "#demos",
};

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

function useHole(selector: string | undefined, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return;
    }
    const sel = selector;
    function measure() {
      const el = document.querySelector(sel);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "start", inline: "nearest" });
      setRect(el.getBoundingClientRect());
    }
    measure();
    const t = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 280);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector, active]);
  return rect;
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
  const finishRef = useRef<() => void>(() => undefined);

  const allSteps: { id: StepId; title: string; body: string; cta: string }[] = [
    {
      id: "what",
      title: "This is Stomp Lab",
      body: "You type a song you already play. We research how that guitar or bass was recorded and build a starting-point preset for your Line 6. You download a file. Then it lives on the hardware.",
      cta: "I have a Line 6",
    },
    {
      id: "rig",
      title: "Which box is yours?",
      body: "Pick guitar or bass, then the unit on your board. Every file we make is for this one. You can change it later in the header.",
      cta: "That's my unit",
    },
    {
      id: "snaps",
      title: "Three switches. Three sounds.",
      body: "Tap verse, chorus, and solo. A song is never one tone — crunch stays on verse, the boost is its own switch. We never mash them together.",
      cta: "Show me where to type",
    },
    {
      id: "song",
      title: "Type a song here",
      body: "Two letters is enough — artwork pops up if we know it. Build this preset researches the record and gives you the file.",
      cta: "Show me a free demo",
    },
    {
      id: "demo",
      title: "Or skip typing — tap a demo",
      body: "Sandman, Teen Spirit, and Numb always work. No account. Open one to see the replica, twist knobs, then download.",
      cta: device.mobile ? "Next" : "Open Enter Sandman",
    },
    {
      id: "home",
      title: "Put the Lab on your home screen",
      body: device.ios
        ? "Safari only. Tap Share (square with an arrow), then Add to Home Screen. The cream SL tile is the Lab — same mark as the tab."
        : "Browser menu → Add to Home screen (or Install app). The cream SL tile is the Lab.",
      cta: "Open Enter Sandman",
    },
  ];
  const steps = device.mobile ? allSteps : allSteps.filter((s) => s.id !== "home");

  const current = steps[step];
  const spotlight = current ? SPOTLIGHT[current.id] : undefined;
  const hole = useHole(spotlight, Boolean(open && spotlight));

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      setStep(0);
    } else {
      try {
        if (!window.localStorage.getItem(TUTORIAL_KEY)) setOpen(true);
      } catch {
        /* ignore */
      }
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
    if (pathname !== "/") void navigate({ to: "/" });
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

  finishRef.current = finish;

  useLayoutEffect(() => {
    if (!open || current?.id !== "demo") return;
    function onPointer(e: Event) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("#demos button[aria-label]")) finishRef.current();
    }
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open, current?.id]);

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
    if (current.id === "home" || (current.id === "demo" && !device.mobile)) {
      openSandman();
      return;
    }
    go(step + 1);
  };

  const card = (
    <div className="flex max-h-[min(88dvh,52rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-3">
        <div className="flex items-center gap-3">
          <Mark size="sm" />
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {step + 1} / {steps.length}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>
        <h2 id="tutorial-title" className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {current.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        {current.id === "what" ? (
          <div className="mt-5 space-y-4">
            <LedStrip />
            <SignalPath />
            <p className="text-xs leading-relaxed text-muted-foreground">
              HX Stomp, XL, Helix Floor, LT, HX Effects, or POD Go. Computer: HX Edit or POD Go Edit → File → Import. Don’t drag the file.
            </p>
          </div>
        ) : null}

        {current.id === "rig" ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["guitar", "bass"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInstrument(id)}
                  className={cn(
                    "min-h-12 rounded-2xl border px-4 py-3 text-left font-display text-lg font-semibold uppercase tracking-tight",
                    instrument === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STOMP_DEVICES.map((d) => {
                const on = stompModel === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setStompModel(d.id as StompModelId)}
                    className={cn(
                      "min-h-12 rounded-2xl border px-3 py-3 text-left",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                    )}
                  >
                    <span className="block font-display text-sm font-semibold uppercase tracking-tight">{d.short}</span>
                    <span className={cn("mt-1 block text-[11px]", on ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {d.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {current.id === "snaps" ? (
          <div className="mt-5 space-y-3">
            <MiniStomp />
            <p className="text-center text-xs text-muted-foreground">Tap a switch. That’s a snapshot.</p>
          </div>
        ) : null}

        {current.id === "home" && device.mobile ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary p-4">
              <Mark size="md" />
              <div>
                <p className="font-display text-lg font-semibold uppercase tracking-tight">Stomp Lab</p>
                <p className="text-xs text-muted-foreground">Cream tile. Black SL. That’s the icon.</p>
              </div>
            </div>
            {device.ios ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Tap Share in Safari (square with an arrow).</li>
                <li>Scroll to Add to Home Screen.</li>
                <li>Tap Add. The cream SL tile lands on the home screen.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Tap the browser menu (three dots).</li>
                <li>Tap Add to Home screen or Install app.</li>
                <li>Confirm. The cream SL tile is the Lab.</li>
              </ol>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-5 py-3">
        <Button type="button" onClick={primary}>
          {current.cta}
        </Button>
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => go(step - 1)}>
            Back
          </Button>
        ) : null}
        <button
          type="button"
          className="ml-auto min-h-10 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={finish}
        >
          Skip tour
        </button>
      </div>
    </div>
  );

  if (!spotlight) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/96 p-3 backdrop-blur-sm sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
          className="flex max-h-[min(92dvh,52rem)] w-full justify-center"
        >
          {card}
        </div>
      </div>
    );
  }

  const pad = 8;
  const holeStyle = hole
    ? {
        top: hole.top - pad,
        left: hole.left - pad,
        width: hole.width + pad * 2,
        height: hole.height + pad * 2,
      }
    : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {holeStyle ? (
        <div className="sl-spot-hole absolute" style={holeStyle} />
      ) : (
        <div className="absolute inset-0 bg-foreground/50" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="pointer-events-auto absolute inset-x-0 top-0 flex justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-4"
      >
        {card}
      </div>
    </div>
  );
}

export function replayTutorial() {
  try {
    window.localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TUTORIAL_EVENT));
}
