import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const TUTORIAL_KEY = "stomplab.tutorial.v3";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type Step = {
  id: string;
  title: string;
  body: string;
  target?: string;
  href?: "/" | "/preset/$id";
  presetId?: string;
  waitClick?: boolean;
};

const STEPS: Step[] = [
  {
    id: "hello",
    title: "Walk the real Lab",
    body: "Seven taps. You use the same controls as after the tour. Three demos always work — no account.",
  },
  {
    id: "search",
    title: "Find a recording",
    body: "Tap search. Type two letters of a title, then pick the artwork. That is the exact album we research — not a generic cover.",
    target: "[data-tour='search']",
    href: "/",
    waitClick: true,
  },
  {
    id: "unit",
    title: "Pick the box you own",
    body: "Guitar or bass, then the unit in the header. Stomp, XL, Helix, HX Effects, or POD Go. The replica and the file follow this.",
    target: "[data-tour='unit']",
    href: "/",
  },
  {
    id: "demo",
    title: "Open Enter Sandman",
    body: "Tap this demo card. Always free. You land on the replica with the chain already loaded.",
    target: "[data-tour='demo-sandman']",
    href: "/",
    waitClick: true,
  },
  {
    id: "replica",
    title: "This is the box, looking down",
    body: "The numbers on the caps are the ones HX Edit uses. On XL, 4–6 are the far row and 1–3 are closest to you. MODE and TAP sit where they do on the hardware.",
    target: "[data-tour='replica']",
    href: "/preset/$id",
    presetId: "featured-sandman",
  },
  {
    id: "switch",
    title: "Tap a numbered switch",
    body: "Tap the highlighted cap. Then you can assign a song section or an effect. Intro / verse / solo live on snapshots.",
    target: "[data-tour='replica'] .hx-fs-cap",
    href: "/preset/$id",
    presetId: "featured-sandman",
    waitClick: true,
  },
  {
    id: "download",
    title: "Get it on the box",
    body: "Tap Download. USB to a computer. HX Edit (or POD Go Edit) → File → Import. Do not drag it onto a setlist. PAGE until SNAP or STOMP matches.",
    target: "[data-tour='download']",
    href: "/preset/$id",
    presetId: "featured-sandman",
  },
];

function firstVisible(sel: string): Element | null {
  const nodes = document.querySelectorAll(sel);
  for (const el of nodes) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.height > 8) return el;
  }
  return nodes[0] ?? null;
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
  const [open, setOpen] = useState(Boolean(force));
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

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

  useEffect(() => {
    function replay() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(TUTORIAL_EVENT, replay);
    return () => window.removeEventListener(TUTORIAL_EVENT, replay);
  }, []);

  const current = STEPS[step];

  useEffect(() => {
    if (!open) return;
    function measure() {
      const sel = STEPS[step]?.target;
      if (!sel) {
        setRect(null);
        return;
      }
      const el = firstVisible(sel);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    const timer = window.setInterval(measure, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, pathname]);

  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s?.waitClick || !s.target) return;
    function onClick(e: Event) {
      const el = firstVisible(s.target!);
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      window.setTimeout(() => setStep((n) => Math.min(n + 1, STEPS.length - 1)), 280);
    }
    document.addEventListener("pointerup", onClick, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerup", onClick, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [open, step]);

  function finish() {
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    onClose?.();
  }

  function go(next: number) {
    const s = STEPS[next];
    if (!s) {
      finish();
      return;
    }
    setStep(next);
    if (s.href === "/" && pathname !== "/") {
      void navigate({ to: "/" });
    }
    if (s.href === "/preset/$id" && !pathname.startsWith("/preset/")) {
      void navigate({ to: "/preset/$id", params: { id: s.presetId ?? "featured-sandman" } });
    }
  }

  if (!open) return null;

  const last = step >= STEPS.length - 1;
  const placeAbove = rect ? rect.bottom + 240 > window.innerHeight && rect.top > 160 : false;
  const maxLeft = Math.max(16, window.innerWidth - 24 - Math.min(window.innerWidth - 32, 360));
  const tooltipStyle = rect
    ? {
        top: placeAbove ? undefined : Math.min(rect.bottom + 14, window.innerHeight - 220),
        bottom: placeAbove ? window.innerHeight - rect.top + 14 : undefined,
        left: Math.min(Math.max(16, rect.left), maxLeft),
      }
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {rect ? (
        <div
          className="absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-200"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px color-mix(in oklab, var(--background) 82%, transparent)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-background/80" />
      )}

      <div
        className="pointer-events-auto absolute w-[min(100%-2rem,22rem)] rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-md"
        style={
          tooltipStyle ?? {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }
        }
      >
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Walkthrough · {step + 1} / {STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        {current.waitClick && rect ? (
          <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs text-primary">
            Tap the highlighted control to continue.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {last ? (
            <Button type="button" onClick={finish}>
              Got it — open the Lab
            </Button>
          ) : current.waitClick && rect ? (
            <Button type="button" variant="secondary" onClick={() => go(step + 1)}>
              Skip this tap
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
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={finish}
          >
            Skip
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