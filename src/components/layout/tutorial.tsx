import { useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { STOMP_DEVICES } from "@/data/categories";
import { FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { parseStompModelId } from "@/data/types";
import { saveMyProfile } from "@/lib/billing";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";
import { Mark } from "./mark";

export const TUTORIAL_KEY = "stomplab.tutorial.v7";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type StepId = "welcome" | "rig" | "song" | "replica" | "import";

const STEPS: {
  id: StepId;
  title: string;
  body: string;
  image?: { src: string; alt: string };
}[] = [
  {
    id: "welcome",
    title: "A song in. A preset out.",
    body: "Stomp Lab looks up a recording and builds a Line 6 preset for the unit you actually own. You see it on a replica of that unit, then download a file HX Edit or POD Go Edit can import. Three demos — Sandman, Teen Spirit, Numb — always work with no account.",
  },
  {
    id: "rig",
    title: "Your guitar and your box",
    body: "Pick both. The replica, the switch numbers, and the download file all follow this. HX Stomp / XL / Floor / LT / Effects write a .hlx. POD Go writes a .pgp. You can change this any time in the header.",
  },
  {
    id: "song",
    title: "Type a song you already play",
    body: "On the Lab, type two letters of the title. Tap the artwork if it pops up, then Build this preset. Featured demos never count against your free builds. Custom research needs a sign-in — three free, then a subscription.",
    image: { src: "/tutorial/lab.png", alt: "The Lab: type a song, then build the preset" },
  },
  {
    id: "replica",
    title: "Switch 1 is top-left",
    body: "You are looking down at the unit. LCD at the top. Number 1 is the top-left footswitch — the same number HX Edit writes into the file. Snapshot mode is verse / chorus / solo. Stomp mode is pedals on a board. Tap a numbered switch to assign it.",
    image: { src: "/tutorial/replica.png", alt: "HX Stomp replica with numbered footswitches" },
  },
  {
    id: "import",
    title: "Import. Don't drag.",
    body: "USB from the unit to a computer. Open HX Edit (Helix family) or POD Go Edit. File → Import, then pick the .hlx or .pgp — never drag it onto a setlist. Firmware 3.80 or newer. On the unit, press PAGE until the screen says SNAP or STOMP, matching what you downloaded.",
  },
];

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
  const instrument = useAppStore((s) => s.instrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);

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

  const current = STEPS[step];

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
    if (!STEPS[next]) {
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

  const last = step >= STEPS.length - 1;

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
              How Stomp Lab works · {step + 1} / {STEPS.length}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
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
                          ? "border-primary bg-secondary text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      <span className="block font-display text-xl font-semibold capitalize">{id}</span>
                      <span className="mt-1 block text-xs leading-relaxed">
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
                          ? "border-primary bg-secondary text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <span className="block text-sm font-medium text-foreground">{d.name}</span>
                      <span className="block text-[11px]">
                        {d.footswitches} switches
                        {d.exportFormat === "pgp" ? " · .pgp" : d.exportFormat === "none" ? " · no file" : " · .hlx"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {current.id === "import" ? (
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              <li>USB from the unit to a computer.</li>
              <li>HX Edit for Helix / HX. POD Go Edit for POD Go.</li>
              <li>File → Import. Pick the file. Do not drag it onto a setlist.</li>
              <li>PAGE on the unit until it says SNAP or STOMP.</li>
              <li>Switch 1 is top-left. If a snapshot does nothing, PAGE once more.</li>
            </ol>
          ) : null}

          {current.image ? (
            <img
              src={current.image.src}
              alt={current.image.alt}
              className="mt-5 w-full rounded-xl border border-border object-cover"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-6 py-4">
          {last ? (
            <Button type="button" onClick={openSandman}>
              Open Enter Sandman
            </Button>
          ) : (
            <Button type="button" onClick={() => go(step + 1)}>
              Next
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
