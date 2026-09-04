import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { STOMP_DEVICES } from "@/data/categories";
import type { StompModelId } from "@/data/types";
import { parseStompModelId } from "@/data/types";
import { saveMyProfile } from "@/lib/billing";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { ONBOARD_KEY, persistInstrumentUnit } from "./onboarding";

export const TUTORIAL_KEY = "stomplab.tutorial.v6";
export const TUTORIAL_EVENT = "stomplab:tutorial";

type StepId = "play" | "unit" | "song" | "replica" | "download";

const STEPS: { id: StepId; title: string; body: string; target?: string; href?: "/" | "/preset/$id"; waitClick?: boolean }[] = [
  {
    id: "play",
    title: "What do you play?",
    body: "Tap one. You can change this any time in the header.",
  },
  {
    id: "unit",
    title: "Which box?",
    body: "The replica, the switch numbers, and the file all follow this.",
  },
  {
    id: "song",
    title: "Type a song you know",
    body: "Two letters is enough. Tap the artwork once — then Build this preset. Sandman, Teen Spirit, and Numb always work with no account.",
    target: "[data-tour='song']",
    href: "/",
    waitClick: true,
  },
  {
    id: "replica",
    title: "Switch 1 is top-left",
    body: "You are looking down at the unit. LCD at the top. Number 1 is the top-left switch — same number HX Edit and the .hlx use. Tap it.",
    target: "[data-tour='replica'] [data-fs='1']",
    href: "/preset/$id",
    waitClick: true,
  },
  {
    id: "download",
    title: "Import. Don't drag.",
    body: "USB to a computer. HX Edit or POD Go Edit → File → Import. Firmware 3.80 or newer. On the unit, PAGE until it says SNAP or STOMP.",
    target: "[data-tour='download']",
    href: "/preset/$id",
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
  const { user } = useCurrentUserState();
  const setInstrument = useAppStore((s) => s.setInstrument);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const instrument = useAppStore((s) => s.instrument);
  const stompModel = useAppStore((s) => s.stompModel);
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
      window.setTimeout(() => setStep((n) => Math.min(n + 1, STEPS.length - 1)), 220);
    }
    document.addEventListener("pointerup", onClick, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerup", onClick, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [open, step]);

  function markDone() {
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "1");
      window.localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function finish() {
    persistInstrumentUnit(instrument, stompModel);
    if (user) {
      void saveMyProfile({
        data: { displayName: "", instrument, stompModel, genres: [] },
      }).catch(() => undefined);
    }
    markDone();
    setOpen(false);
    onClose?.();
  }

  function go(next: number) {
    const s = STEPS[next];
    if (!s) {
      finish();
      return;
    }
    if (next >= 2) {
      persistInstrumentUnit(instrument, stompModel);
    }
    setStep(next);
    if (s.href === "/" && pathname !== "/") {
      void navigate({ to: "/" });
    }
    if (s.href === "/preset/$id" && !pathname.startsWith("/preset/")) {
      void navigate({ to: "/preset/$id", params: { id: "featured-sandman" } });
    }
  }

  if (!open) return null;

  const last = step >= STEPS.length - 1;
  const picker = current.id === "play" || current.id === "unit";
  const cardH = 340;
  const placeAbove = rect ? rect.bottom + cardH > window.innerHeight && rect.top > cardH : false;
  const maxLeft = Math.max(16, window.innerWidth - 24 - Math.min(window.innerWidth - 32, 384));
  const tooltipStyle = !picker && rect
    ? {
        top: placeAbove ? undefined : Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - cardH - 16)),
        bottom: placeAbove ? Math.max(16, window.innerHeight - rect.top + 12) : undefined,
        left: Math.min(Math.max(16, rect.left), maxLeft),
        maxHeight: "min(70vh, 24rem)",
        overflow: "auto" as const,
      }
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {picker ? (
        <div className="absolute inset-0 bg-background/88 backdrop-blur-sm" />
      ) : rect ? (
        <div
          className="absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-200"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px color-mix(in oklab, var(--background) 78%, transparent)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-background/80" />
      )}

      <div
        className="pointer-events-auto absolute w-[min(100%-2rem,24rem)] rounded-2xl border border-border bg-card p-6 shadow-2xl"
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
        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {step + 1} / {STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        {current.id === "play" ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(["guitar", "bass"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setInstrument(id);
                  persistInstrumentUnit(id, stompModel);
                  go(1);
                }}
                className={cn(
                  "rounded-2xl border px-4 py-6 text-left transition-colors",
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
        ) : null}

        {current.id === "unit" ? (
          <div className="mt-4 grid max-h-64 gap-1.5 overflow-y-auto pr-1">
            {STOMP_DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  const id = parseStompModelId(d.id) as StompModelId;
                  setStompModel(id);
                  persistInstrumentUnit(instrument, id);
                  go(2);
                }}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
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
        ) : null}

        {current.waitClick && rect && current.id !== "play" && current.id !== "unit" ? (
          <p className="mt-4 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground">
            Tap the highlighted bit once.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {last ? (
            <Button type="button" onClick={finish}>
              Open the Lab
            </Button>
          ) : current.id === "play" || current.id === "unit" ? (
            <Button type="button" variant="secondary" onClick={() => go(step + 1)}>
              Skip
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
