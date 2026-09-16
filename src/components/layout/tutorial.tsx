import { useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { STOMP_DEVICES } from "@/data/categories";
import { FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { parseStompModelId } from "@/data/types";
import { GuitarRolePicker } from "@/components/layout/guitar-role";
import { saveMyProfile } from "@/lib/billing";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";
import { Mark } from "./mark";

export const TUTORIAL_KEY = "stomplab.tutorial.v11";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type StepId = "welcome" | "rig" | "part" | "home" | "try";

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
  const { user } = useCurrentUserState();
  const setInstrument = useAppStore((s) => s.setInstrument);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const setGuitarRole = useAppStore((s) => s.setGuitarRole);
  const instrument = useAppStore((s) => s.instrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const guitarRole = useAppStore((s) => s.guitarRole);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);
  const device = useMemo(() => detectDevice(), []);

  const steps: { id: StepId; title: string; body: string }[] = [
    {
      id: "welcome",
      title: "A song in. A preset out.",
      body: "Stomp Lab looks up how a record was tracked and builds a starting-point preset for the Line 6 unit you own. You see it on a replica of that unit, then download a file HX Edit or POD Go Edit can import.",
    },
    {
      id: "rig",
      title: "Your guitar and your box",
      body: "Pick both. The replica, the switch numbers, and the download file all follow this. You can change it any time in the header.",
    },
    {
      id: "part",
      title: "Rhythm, lead, or both",
      body: "Rhythm and lead are different tones. Don’t mash them. Pick both and we put rhythm on snapshot 1 and lead on a later snapshot, sharing the same amp.",
    },
    {
      id: "home",
      title: device.mobile ? "Put it on your home screen" : "Use it from this browser",
      body: device.ios
        ? "On iPhone or iPad, open this page in Safari. Tap Share, then Add to Home Screen. The cream SL tile is the Lab — that’s the icon that should appear."
        : device.android
          ? "On Android, open the browser menu and tap Add to Home screen (or Install app). The cream SL tile is the Lab."
          : "You’re on a computer. Build here, then USB the file to the unit with HX Edit. On a phone, we’ll show how to add the Lab to the home screen.",
    },
    {
      id: "try",
      title: "Try a demo. No account.",
      body: "Sandman, Teen Spirit, and Numb always work. Custom songs need a sign-in — three free, then a subscription. File → Import in HX Edit. Don’t drag the file onto a setlist.",
    },
  ];

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (!window.localStorage.getItem(TUTORIAL_KEY)) setOpen(true);
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

  const current = steps[step];

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
    if (user) {
      void saveMyProfile({
        data: { displayName: "", instrument, stompModel, genres: [] },
      }).catch(() => undefined);
    }
  }

  function finish() {
    persist();
    markDone();
    setOpen(false);
    onClose?.();
  }

  function go(next: number) {
    if (next < 0) return;
    if (!steps[next]) {
      finish();
      return;
    }
    if (next >= 1) persist();
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

  const last = step >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/88 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <Mark size="sm" />
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              How Stomp Lab works · {step + 1} / {steps.length}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
          <h2 id="tutorial-title" className="mt-5 font-display text-3xl font-semibold tracking-tight">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

          {current.id === "welcome" ? (
            <ol className="mt-5 space-y-3">
              {[
                { n: "1", t: "Type a song you already play" },
                { n: "2", t: "We build a preset for your unit" },
                { n: "3", t: "Download. File → Import in HX Edit" },
              ].map((row) => (
                <li key={row.n} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-semibold text-primary-foreground">
                    {row.n}
                  </span>
                  <span className="pt-1.5 text-sm font-medium">{row.t}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {current.id === "rig" ? (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">You play</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["guitar", "bass"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setInstrument(id);
                        persistInstrumentUnit(id, stompModel);
                      }}
                      className={cn(
                        "min-h-16 rounded-2xl border px-4 py-4 text-left transition-colors",
                        instrument === id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      <span className="block font-display text-xl font-semibold capitalize">{id}</span>
                      <span className="mt-1 block text-xs leading-relaxed opacity-80">
                        {id === "guitar" ? "Six-string, offsets, high-gain" : "4/5-string, DI, grit"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The unit</p>
                <div className="mt-2 grid max-h-52 gap-1.5 overflow-y-auto pr-1">
                  {STOMP_DEVICES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        const id = parseStompModelId(d.id) as StompModelId;
                        setStompModel(id);
                        persistInstrumentUnit(instrument, id);
                      }}
                      className={cn(
                        "min-h-11 rounded-xl border px-4 py-3 text-left transition-colors",
                        stompModel === d.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <span className="block text-sm font-medium">{d.name}</span>
                      <span className="block text-[11px] opacity-80">
                        {d.footswitches} switches
                        {d.exportFormat === "pgp" ? " · .pgp" : d.exportFormat === "none" ? " · no file" : " · .hlx"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {current.id === "part" ? (
            <div className="mt-5">
              <GuitarRolePicker value={guitarRole} onChange={setGuitarRole} />
            </div>
          ) : null}

          {current.id === "home" ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary p-4">
                <Mark size="md" />
                <div>
                  <p className="font-display text-lg font-semibold uppercase tracking-tight">Stomp Lab</p>
                  <p className="text-xs text-muted-foreground">Cream tile. Black SL. That’s the icon.</p>
                </div>
              </div>
              {device.ios ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                  <li>Tap the Share button in Safari (square with an arrow).</li>
                  <li>Scroll to Add to Home Screen.</li>
                  <li>Tap Add. The cream SL tile should land on your home screen.</li>
                </ol>
              ) : device.android ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                  <li>Tap the browser menu (three dots).</li>
                  <li>Tap Add to Home screen or Install app.</li>
                  <li>Confirm. The cream SL tile is the Lab.</li>
                </ol>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Bookmark this page if you want. On a phone, open the Lab in Safari or Chrome and we’ll walk you through Add to Home Screen.
                </p>
              )}
            </div>
          ) : null}

          {current.id === "try" ? (
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              <li>USB from the unit to a computer.</li>
              <li>HX Edit for Helix / HX. POD Go Edit for POD Go.</li>
              <li>File → Import. Pick the file. Do not drag it onto a setlist.</li>
              <li>PAGE on the unit until it says SNAP or STOMP.</li>
              <li>Switch 1 is top-left. If a snapshot is silent, PAGE once more.</li>
            </ol>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-6 py-4">
          {last ? (
            <Button type="button" onClick={openSandman}>
              Open Enter Sandman
            </Button>
          ) : (
            <Button type="button" onClick={() => go(step + 1)}>
              {current.id === "rig" || current.id === "part" ? "Looks right" : "Next"}
            </Button>
          )}
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
