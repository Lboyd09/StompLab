import { useLayoutEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "stomplab.onboarded.v1";

const STEPS = [
  {
    title: "Open a demo",
    body: "Sandman, Teen Spirit, and Comfortably Numb always load. No account. See the song on the replica first.",
  },
  {
    title: "Play the replica",
    body: "Snapshot is verse/chorus. Stomp is effects on/off. Switch 1 is top-left — same map the file writes onto the unit.",
  },
  {
    title: "Import the .hlx",
    body: "Download. HX Edit → File → Import. PAGE until SNAP or STOMP matches. Then play.",
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useLayoutEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-background/70 p-4 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          First time · {step + 1} / {STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={dismiss}>
              Start in the Lab
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          <Link to="/guide" className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={dismiss}>
            Full tutorial
          </Link>
        </div>
      </div>
    </div>
  );
}
