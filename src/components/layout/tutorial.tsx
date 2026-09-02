import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const TUTORIAL_KEY = "stomplab.tutorial.v1";

const STEPS = [
  {
    title: "Type a song. Get a chain.",
    body: "Guitar or bass, and your unit, live in the header. Type two letters of a title, pick the recording, hit Build. Three demos always work with no account.",
    img: "/tutorial/lab.png",
    alt: "Stomp Lab home — song search and demo cards",
  },
  {
    title: "See it on the replica",
    body: "The replica is the unit looking down. Snapshot mode is verse/chorus. Stomp mode is pedals on/off. Tap a switch, then assign what it does.",
    img: "/tutorial/replica.png",
    alt: "HX Stomp replica with a researched preset",
  },
  {
    title: "Download a file HX Edit will import",
    body: "USB to a computer. HX Edit → File → Import the .hlx. Firmware 3.80+. Do not drag it onto a setlist. PAGE until SNAP or STOMP matches what you downloaded.",
    img: "/tutorial/replica.png",
    alt: "Preset on the replica ready to download",
  },
  {
    title: "Catalog is the real names",
    body: "Every HX model, plus what it is based on. Find equivalent maps a TS808 or a Klon to the Line 6 name. Shop links on the gear if you want the original pedal.",
    img: "/tutorial/catalog.png",
    alt: "HX catalog of models and based-on names",
  },
  {
    title: "Create a sound from a sentence",
    body: "Describe a board or a feeling. Same replica, same .hlx. Counts as a custom build.",
    img: "/tutorial/create.png",
    alt: "Create page for describing a custom sound",
  },
] as const;

export function Tutorial({
  force,
  onClose,
}: {
  force?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);

  useLayoutEffect(() => {
    if (force) {
      setOpen(true);
      return;
    }
    try {
      if (!window.localStorage.getItem(TUTORIAL_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, [force]);

  function finish() {
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-background/80 p-4 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div className="aspect-[16/10] bg-secondary">
          <img src={current.img} alt={current.alt} className="size-full object-cover object-top" />
        </div>
        <div className="p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Tutorial · {step + 1} / {STEPS.length}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={finish}>
                Got it — open the Lab
              </Button>
            )}
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={finish}
            >
              Skip
            </button>
          </div>
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
  window.location.reload();
}
