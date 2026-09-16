import { useState } from "react";
import { cn } from "@/lib/utils";

const NODES = [
  { id: "song", led: "sl-led-lcd sl-led-on", bar: "sl-node-bar-lcd", title: "A song", hint: "You type a title you already play" },
  { id: "lab", led: "sl-led-signal sl-led-on", bar: "sl-node-bar-signal", title: "The Lab", hint: "We build the chain for your unit" },
  { id: "file", led: "sl-led-pulse sl-led-on", bar: "sl-node-bar-pulse", title: "A file", hint: "HX Edit → File → Import" },
] as const;

/** Song → Lab → file. Same idea on the homepage and the first-run tour. */
export function SignalPath({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch", className)}>
      {NODES.map((n, i) => (
        <li key={n.id} className="contents">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <span className={cn("sl-node-bar", n.bar)} aria-hidden />
            <div className="p-4">
              <span className={cn("sl-led", n.led)} aria-hidden />
              <p className="mt-3 font-display text-lg font-semibold uppercase leading-none tracking-tight">{n.title}</p>
              <p className="mt-2 text-sm leading-snug text-muted-foreground">{n.hint}</p>
            </div>
          </div>
          {i < NODES.length - 1 ? (
            <>
              <span className="sl-path-wire hidden self-center sm:block" aria-hidden />
              <span className="sl-path-wire-v mx-auto sm:hidden" aria-hidden />
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

const SCENES = [
  { l: "VERSE", c: "sl-led-lcd", lcd: "VERSE" },
  { l: "CHORUS", c: "sl-led", lcd: "CHORUS" },
  { l: "SOLO", c: "sl-led-pulse", lcd: "SOLO" },
] as const;

/** Three fake footswitches: verse / chorus / solo. Tap to learn snapshots. */
export function MiniStomp({
  song = "SANDMAN",
  className,
}: {
  song?: string;
  className?: string;
}) {
  const [scene, setScene] = useState(0);
  const current = SCENES[scene] ?? SCENES[0];
  return (
    <div className={cn("hx-chassis hx-chassis-stomp mx-auto w-full max-w-sm px-4 py-4", className)}>
      <div className="hx-lcd mx-auto mb-3 grid place-items-center text-[10px] tracking-[0.18em] text-lcd">
        <span className="opacity-70">{song}</span>
        <span className="mt-1 font-semibold">{current.lcd}</span>
      </div>
      <div className="flex justify-center gap-3">
        {SCENES.map((s, i) => {
          const on = i === scene;
          return (
            <button
              key={s.l}
              type="button"
              onClick={() => setScene(i)}
              aria-pressed={on}
              className="flex min-h-14 min-w-14 flex-col items-center gap-2 rounded-xl px-1"
            >
              <span className={cn("sl-led", s.c, on && "sl-led-on")} />
              <span className="hx-scribble text-center">{s.l}</span>
              <span className={cn("hx-fs hx-fs-cap rounded-full", on && "ring-2 ring-lcd/70")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LedStrip({ className }: { className?: string }) {
  const kinds = ["sl-led-lcd", "sl-led", "sl-led-signal", "sl-led-pulse"] as const;
  return (
    <div className={cn("sl-led-strip", className)} aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className={cn("sl-led sl-led-on", kinds[i % kinds.length])} />
      ))}
    </div>
  );
}
