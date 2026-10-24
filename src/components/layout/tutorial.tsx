import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { demosFor, welcomeDemo } from "@/components/onboarding/demo-rig";
import { DemoReel, TryRig, UnitArt } from "@/components/onboarding/rig-visual";
import { STOMP_DEVICES } from "@/data/categories";
import { playbackOptionsFor } from "@/data/playback";
import { FREE_BUILD_LINE } from "@/lib/copy";
import { isDemoId } from "@/lib/preset-utils";
import { useOpenFeatured } from "@/lib/use-open-featured";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { Mark } from "./mark";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";

export const TUTORIAL_KEY = "stomplab.tutorial.v20";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type Step = "what" | "try" | "rig" | "play";
const STEPS: Step[] = ["what", "try", "rig", "play"];
const STEP_LABEL: Record<Step, string> = { what: "What it is", try: "Try it", rig: "Your rig", play: "Play" };

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
}

function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  return isIos() || /Android/i.test(navigator.userAgent || "") || Boolean(window.matchMedia?.("(pointer: coarse)").matches);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * First visit on the home page: show what Stomp Lab makes, let the player tap through a real demo,
 * then set up their rig and open a free demo built for it. A shared /preset, /catalog or /upgrade link never opens this.
 */
export function Tutorial({ force, onClose }: { force?: boolean; onClose?: () => void }) {
  const navigate = useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const playbackTarget = useAppStore((s) => s.playbackTarget);
  const setPlaybackTarget = useAppStore((s) => s.setPlaybackTarget);
  const openFeaturedPreset = useOpenFeatured();
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);
  const [snap, setSnap] = useState(0);
  const [tried, setTried] = useState<Set<number>>(() => new Set([0]));
  const phone = useMemo(() => isPhone(), []);
  const ios = useMemo(() => isIos(), []);
  const rigs = playbackOptionsFor(stompModel);
  const demo = useMemo(() => welcomeDemo(), []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (window.localStorage.getItem(TUTORIAL_KEY)) return setOpen(false);
      // v19 is left out on purpose: everyone who saw the old setup sees this one once.
      const prior = ["v18", "v17", "v16", "v15", "v14", "v13", "v12", "v11", "v10", "v9", "v8", "v7", "v6", "v5"];
      if (prior.some((v) => window.localStorage.getItem(`stomplab.tutorial.${v}`))) {
        window.localStorage.setItem(TUTORIAL_KEY, "1");
        return setOpen(false);
      }
      setOpen(window.location.pathname === "/");
    } catch {
      setOpen(window.location.pathname === "/");
    }
  }, [force]);

  useLayoutEffect(() => {
    function replay() {
      setStep(0);
      setSnap(0);
      setTried(new Set([0]));
      setOpen(true);
      if (window.location.pathname !== "/") void navigate({ to: "/" });
    }
    window.addEventListener(TUTORIAL_EVENT, replay);
    return () => window.removeEventListener(TUTORIAL_EVENT, replay);
  }, [navigate]);

  useLayoutEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.documentElement.classList.add("sl-touring");
    return () => {
      document.documentElement.classList.remove("sl-touring");
      restoreRef.current?.focus?.();
    };
  }, [open]);

  // Each screen starts at its heading, so a screen reader reads the new step and Tab starts at the top.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    dialogRef.current?.querySelector<HTMLElement>("[data-scroll]")?.scrollTo({ top: 0 });
  }, [open, step]);

  // A rig this unit can't do (4-cable on a unit without a loop) falls back to the first one it can.
  useLayoutEffect(() => {
    if (rigs.length && !rigs.some((r) => r.id === playbackTarget)) setPlaybackTarget(rigs[0].id);
  }, [rigs, playbackTarget, setPlaybackTarget]);

  function finish() {
    persistInstrumentUnit(instrument, stompModel);
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "1");
      window.localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* private mode: it just asks again next time */
    }
    setOpen(false);
    onClose?.();
  }

  function openDemo(id: string) {
    // Only the free demos open from here; a paid featured rig never slips past the paywall.
    const preset = isDemoId(id) ? openFeaturedPreset(id) : null;
    finish();
    if (preset) void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  function pickSnap(i: number) {
    setSnap(i);
    setTried((s) => new Set(s).add(i));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      finish();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;
  const current = STEPS[step];
  const device = STOMP_DEVICES.find((d) => d.id === stompModel);
  const unitName = device?.name ?? "your unit";
  const editor = stompModel === "pod-go" ? "POD Go Edit" : "HX Edit";
  const { demos, fallback } = demosFor(instrument);
  const triedAll = tried.size >= Math.min(3, demo.snapshots.length);
  const next = () => setStep((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setStep((n) => Math.max(0, n - 1));

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
      onKeyDown={onKeyDown}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,color-mix(in_oklab,var(--color-pop)_10%,transparent),transparent_70%),radial-gradient(50%_45%_at_5%_95%,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent_70%)]"
      />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-10 md:pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <Mark size="sm" />
          <span className="hidden font-display text-lg font-semibold uppercase tracking-wide sm:inline">Stomp Lab</span>
        </div>
        <ol className="flex items-center gap-1.5 md:gap-5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
              <span className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-8 bg-pop" : i < step ? "w-4 bg-primary" : "w-4 bg-secondary md:bg-foreground/15")} />
              <span className={cn("hidden font-mono text-[11px] uppercase tracking-[0.2em] lg:inline", i === step ? "text-foreground" : "text-muted-foreground")}>
                {STEP_LABEL[s]}
              </span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={finish} className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground" aria-label="Skip setup">
          Skip <X className="size-4" aria-hidden />
        </button>
      </header>

      <div data-scroll className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div key={current} className="sl-tour-step mx-auto grid min-h-full w-full max-w-7xl items-center gap-6 px-4 py-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 md:px-10 md:py-8 lg:gap-20">
          {current === "what" ? (
            <>
              <Copy kicker="For HX Stomp, Helix and POD Go">
                <h1 id="setup-title" tabIndex={-1} className="sl-hero-title text-[clamp(2.4rem,5.4vw,5rem)] outline-none">
                  <span className="block">Type a song.</span>
                  <span className="mt-1 block text-primary">Get that {instrument === "bass" ? "bass" : "guitar"} rig.</span>
                </h1>
                <span className="sl-hero-rule" aria-hidden />
                <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground md:text-lg">
                  Stomp Lab researches the tone on the record and builds a preset you import into your Line 6: the pedals, the amp, the knobs, and a
                  switch for each part of the song.
                </p>
                <ol className="hidden max-w-lg gap-3 text-sm md:grid">
                  {[
                    ["Type a song", "Any released song, guitar or bass."],
                    ["We research the record", "Who played it, through what, and how each part changes."],
                    ["Import and play", `Download the file, open it in ${editor}, step on a switch.`],
                  ].map(([title, body], i) => (
                    <li key={title} className="flex gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border font-mono text-[11px] text-pop">{i + 1}</span>
                      <span>
                        <span className="font-medium">{title}.</span> <span className="text-muted-foreground">{body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Copy>
              <Visual caption={`A real demo: ${demo.song}, ${demo.artist}. A researched starting point, not a copy of the record.`}>
                <DemoReel preset={demo} />
              </Visual>
            </>
          ) : current === "try" ? (
            <>
              <Copy kicker="Try it">
                <h1 id="setup-title" tabIndex={-1} className="sl-hero-title text-[clamp(2.1rem,4.4vw,4rem)] outline-none">
                  Tap a switch. The rig follows the song.
                </h1>
                <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground md:text-lg">
                  <span className="md:hidden">Every part of the song is a switch. Tap them below.</span>
                  <span className="hidden md:inline">Each part of {demo.song} has its own footswitch. Tap {demo.snapshots.slice(0, 3).map((s) => s.name).join(", ").replace(/, ([^,]*)$/, " and $1")}: pedals turn on and
                  off, and the amp knobs move.</span>
                </p>
                <p className={cn("flex items-center gap-2 text-sm", triedAll ? "text-pop" : "text-muted-foreground")} aria-live="polite">
                  {triedAll ? <Check className="size-4" aria-hidden /> : null}
                  {triedAll ? "That's it. Every song you build works like this." : `${tried.size} of ${Math.min(3, demo.snapshots.length)} switches tried`}
                </p>
              </Copy>
              <Visual>
                <TryRig preset={demo} active={snap} onPick={pickSnap} tried={tried} />
              </Visual>
            </>
          ) : current === "rig" ? (
            <>
              <Copy kicker="Your rig">
                <h1 id="setup-title" tabIndex={-1} className="sl-hero-title text-[clamp(2.1rem,4.4vw,4rem)] outline-none">
                  What do you play?
                </h1>
                <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
                  Every file is built for your unit: its blocks, its switches, its file type. Change it any time in Settings.
                </p>
                <div className="grid max-w-xs grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="radiogroup" aria-label="Instrument">
                  {(["guitar", "bass"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={instrument === id}
                      onClick={() => setInstrument(id)}
                      className={cn(
                        "min-h-11 rounded-full text-sm font-medium capitalize transition-colors",
                        instrument === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </Copy>
              <div className="min-w-0 space-y-5">
                <fieldset className="space-y-2">
                  <legend className="sl-kicker mb-2">My unit</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Your unit">
                    {STOMP_DEVICES.map((d) => {
                      const on = d.id === stompModel;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setStompModel(d.id)}
                          className={cn(
                            "sl-card relative flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium sm:min-h-[92px] sm:flex-col sm:items-start sm:justify-between sm:gap-2 sm:py-3",
                            on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          <UnitArt device={d} className={cn("h-6 shrink-0 sm:h-8", on ? "text-primary" : "text-foreground/70")} />
                          <span className="pr-4 leading-tight text-foreground">{d.name}</span>
                          {on ? <Check className="absolute right-2.5 top-2.5 size-4 text-primary" aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="sl-kicker mb-2">I play through</legend>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Playing through">
                    {rigs.map((r) => {
                      const on = r.id === playbackTarget;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setPlaybackTarget(r.id)}
                          className={cn("flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors", on ? "border-primary bg-primary/10" : "border-border bg-card")}
                        >
                          <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary" : "border-muted-foreground")} aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{r.label}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{r.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </>
          ) : (
            <>
              <Copy kicker="Ready">
                <h1 id="setup-title" tabIndex={-1} className="sl-hero-title text-[clamp(2.1rem,4.4vw,4rem)] outline-none">
                  Hear it on your {unitName}.
                </h1>
                <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
                  Open a free demo built for your rig. Download it, import it in {editor}, and play. Or type your own song.
                </p>
                <p className="text-sm text-muted-foreground">{FREE_BUILD_LINE}</p>
              </Copy>
              <div className="min-w-0 space-y-3">
                <p className="sl-kicker">Free demos</p>
                {fallback ? <p className="text-sm text-muted-foreground">The free demos are guitar rigs. Bass songs build the same way.</p> : null}
                <div className="grid gap-3">
                  {demos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openDemo(p.id)}
                      className="sl-card group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left md:px-6 md:py-5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.artist}</span>
                        <span className="sl-hero-title mt-1 block text-xl md:text-2xl">{p.song}</span>
                        <span className="mt-1.5 hidden text-sm text-muted-foreground md:line-clamp-1">{p.snapshots.map((s) => s.name).join(" · ")}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:text-pop">
                        <span className="hidden sm:inline">Open on {unitName}</span>
                        <span className="sm:hidden">Open</span>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </button>
                  ))}
                </div>
                {phone ? (
                  <div className="mt-2 rounded-xl bg-secondary/60 p-4 text-sm">
                    <p className="font-medium">Keep it on your home screen</p>
                    <p className="mt-1 text-muted-foreground">
                      {ios ? "In Safari, tap Share, then Add to Home Screen." : "Open the browser menu, then Add to Home screen."}
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="relative border-t border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-10 md:py-4">
          {step > 0 ? (
            <Button type="button" variant="ghost" className="h-12 shrink-0 px-3 text-muted-foreground" onClick={back}>
              <ArrowLeft aria-hidden /> Back
            </Button>
          ) : (
            <span className="hidden text-sm text-muted-foreground md:block">Takes under a minute.</span>
          )}
          <div className="ml-auto flex w-full justify-end sm:w-auto">
            {current === "play" ? (
              <Button type="button" variant="secondary" className="h-12 w-full px-6 sm:w-auto" onClick={finish}>
                I'll type my own song
              </Button>
            ) : (
              <Button type="button" className="h-12 w-full px-6 text-base sm:w-auto sm:px-8" onClick={next}>
                {current === "what" ? "See how it works" : current === "try" ? "Set up my rig" : `That's my ${unitName}`}
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function Copy({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      <p className="sl-kicker">{kicker}</p>
      {children}
    </div>
  );
}

function Visual({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="min-w-0">
      {children}
      {caption ? <p className="mt-3 text-center text-xs text-muted-foreground">{caption}</p> : null}
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
