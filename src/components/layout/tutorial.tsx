import { useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { STOMP_DEVICES } from "@/data/categories";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import { playbackOptionsFor } from "@/data/playback";
import { FREE_BUILD_LINE } from "@/lib/copy";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { applyRouting } from "@/lib/rig-routing";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { Mark } from "./mark";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";

export const TUTORIAL_KEY = "stomplab.tutorial.v19";
export const TUTORIAL_EVENT = "stomplab:tutorial";

const DEMOS = FEATURED.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));

type Step = "unit" | "rig" | "try";
const STEPS: Step[] = ["unit", "rig", "try"];

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
}

function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  return isIos() || /Android/i.test(navigator.userAgent || "") || Boolean(window.matchMedia?.("(pointer: coarse)").matches);
}

/**
 * First visit on the home page: set up the player's rig in three taps, then hear a demo on it.
 * A shared /preset, /catalog or /upgrade link never opens this.
 */
export function Tutorial({ force, onClose }: { force?: boolean; onClose?: () => void }) {
  const navigate = useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const playbackTarget = useAppStore((s) => s.playbackTarget);
  const setPlaybackTarget = useAppStore((s) => s.setPlaybackTarget);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);
  const phone = useMemo(() => isPhone(), []);
  const ios = useMemo(() => isIos(), []);
  const rigs = playbackOptionsFor(stompModel);

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (window.localStorage.getItem(TUTORIAL_KEY)) return setOpen(false);
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
      setOpen(true);
      if (window.location.pathname !== "/") void navigate({ to: "/" });
    }
    window.addEventListener(TUTORIAL_EVENT, replay);
    return () => window.removeEventListener(TUTORIAL_EVENT, replay);
  }, [navigate]);

  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("sl-touring");
    return () => document.documentElement.classList.remove("sl-touring");
  }, [open]);

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
    const src = FEATURED.find((p) => p.id === id);
    if (!src) return finish();
    const preset = applyRouting(overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, stompModel), gear), playbackTarget);
    savePreset(preset);
    finish();
    void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  if (!open) return null;
  const current = STEPS[step];
  const unitName = STOMP_DEVICES.find((d) => d.id === stompModel)?.name ?? "your unit";

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mark size="sm" />
            <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((s, i) => (
                <span key={s} className={cn("h-1.5 w-6 rounded-full", i <= step ? "bg-primary" : "bg-secondary")} />
              ))}
            </div>
          </div>
          <button type="button" onClick={finish} className="flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground" aria-label="Skip setup">
            Skip <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain py-6">
          {current === "unit" ? (
            <>
              <div className="space-y-2">
                <h1 id="setup-title" className="sl-hero-title text-3xl">Which Line 6 do you have?</h1>
                <p className="text-sm text-muted-foreground">Every file is built for this unit: its blocks, its switches, its file type.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
                {(["guitar", "bass"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={instrument === id}
                    onClick={() => setInstrument(id)}
                    className={cn("min-h-11 rounded-full text-sm font-medium capitalize", instrument === id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Your unit">
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
                        "flex min-h-16 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium",
                        on ? "border-primary bg-primary/10" : "border-border bg-card",
                      )}
                    >
                      <span>{d.name}</span>
                      {on ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : current === "rig" ? (
            <>
              <div className="space-y-2">
                <h1 id="setup-title" className="sl-hero-title text-3xl">What do you play through?</h1>
                <p className="text-sm text-muted-foreground">This decides whether the preset keeps its amp and cab. You can change it any time in Settings.</p>
              </div>
              <div className="space-y-2" role="radiogroup" aria-label="Playing through">
                {rigs.map((r) => {
                  const on = r.id === playbackTarget;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPlaybackTarget(r.id)}
                      className={cn("flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left", on ? "border-primary bg-primary/10" : "border-border bg-card")}
                    >
                      <span className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary" : "border-muted-foreground")} aria-hidden />
                      <span>
                        <span className="block text-sm font-medium">{r.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{r.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h1 id="setup-title" className="sl-hero-title text-3xl">Hear it on your {unitName}</h1>
                <p className="text-sm text-muted-foreground">Open a free demo built for your rig. Download it, import it in {stompModel === "pod-go" ? "POD Go Edit" : "HX Edit"}, and play.</p>
              </div>
              <div className="space-y-2">
                {DEMOS.filter((p) => p.instrument === instrument).map((p) => (
                  <button key={p.id} type="button" onClick={() => openDemo(p.id)} className="sl-card w-full rounded-xl border border-border bg-card px-4 py-3 text-left">
                    <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{p.artist}</span>
                    <span className="mt-1 block font-display text-lg font-semibold">{p.song}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{FREE_BUILD_LINE}</p>
              {phone ? (
                <div className="rounded-xl bg-secondary/60 p-4 text-sm">
                  <p className="font-medium">Keep it on your home screen</p>
                  <p className="mt-1 text-muted-foreground">
                    {ios ? "In Safari, tap Share, then Add to Home Screen." : "Open the browser menu, then Add to Home screen."}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          {current === "try" ? (
            <Button type="button" variant="secondary" className="h-12 w-full" onClick={finish}>
              I'll type my own song
            </Button>
          ) : (
            <Button type="button" className="h-12 w-full" onClick={() => setStep((n) => n + 1)}>
              {current === "unit" ? `That's my ${unitName}` : "Next"}
            </Button>
          )}
          {step > 0 ? (
            <button type="button" onClick={() => setStep((n) => n - 1)} className="block min-h-11 w-full text-center text-sm text-muted-foreground">
              Back
            </button>
          ) : null}
        </div>
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
