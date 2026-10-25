import { Check, Download, Link2, ListMusic, SlidersHorizontal, ToggleRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Preset } from "@/data/types";
import { cn } from "@/lib/utils";
import { HardwarePanel, useReducedMotion } from "./rig-visual";

/** A looping clock in 100 ms ticks. Reduced motion parks it on the last frame. */
function useTicks(end: number, loop = true): number {
  const reduce = useReducedMotion();
  const [t, setT] = useState(reduce ? end : 0);
  useEffect(() => {
    if (reduce) {
      setT(end);
      return;
    }
    setT(0);
    const id = window.setInterval(() => setT((n) => (n >= end ? (loop ? 0 : n) : n + 1)), 100);
    return () => window.clearInterval(id);
  }, [end, loop, reduce]);
  return t;
}

const CYAN = "#5ce1e6";
const BLUE = "#3d7eff";

/**
 * "Get it on your unit": the Download button, the file landing in HX Edit, then the unit lighting up
 * part by part. One loop is about seven seconds; the step under the picture follows along.
 */
export function ImportScene({ preset, unitName, editor, ext }: { preset: Preset; unitName: string; editor: string; ext: string }) {
  const END = 72;
  const t = useTicks(END);
  const phase = t < 18 ? 0 : t < 38 ? 1 : 2;
  const pressed = t >= 8 && t < 12;
  const flying = t >= 12 && t < 24;
  const importing = Math.max(0, Math.min(1, (t - 24) / 12));
  const lit = t < 40 ? -1 : Math.min(2, Math.floor((t - 40) / 10));
  const parts = preset.snapshots.slice(0, 3);
  const file = `${(preset.song || preset.name).replace(/\s+/g, " ")}.${ext}`;

  const steps = [
    ["Download", `Tap Download .${ext} on the preset page.`],
    ["Import", `${editor}: File, then Import.`],
    ["Play", "Step on a switch. The parts are already on them."],
  ];

  return (
    <div className="space-y-4">
      <HardwarePanel>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4" aria-hidden>
          {/* 1. Stomp Lab */}
          <Pane on={phase === 0} label="Stomp Lab">
            <p className="truncate text-sm font-semibold">{preset.song}</p>
            <p className="truncate text-xs text-white/50">{preset.artist}</p>
            <span
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-transform duration-150",
                pressed ? "scale-90" : "scale-100",
              )}
              style={{ background: BLUE, boxShadow: pressed ? `0 0 0 4px ${BLUE}55` : undefined }}
            >
              <Download className="size-3.5" /> Download .{ext}
            </span>
            <span
              className={cn(
                "absolute bottom-3 right-3 rounded-md border border-white/15 bg-[#1b2030] px-2 py-1 font-mono text-[10px] transition-all duration-700 ease-[var(--ease-out)]",
                flying ? "translate-x-6 opacity-100 sm:translate-x-24" : t >= 24 ? "translate-x-10 opacity-0 sm:translate-x-40" : "translate-x-0 opacity-0",
              )}
            >
              {file}
            </span>
          </Pane>

          {/* 2. HX Edit */}
          <Pane on={phase === 1} label={editor}>
            <div className="flex gap-3 text-[11px] text-white/45">
              <span className={cn("rounded px-1.5 py-0.5 transition-colors", t >= 18 && t < 30 ? "bg-white/15 text-white" : "")}>File</span>
              <span>Edit</span>
              <span>View</span>
            </div>
            <p className={cn("mt-2 text-xs transition-opacity", t >= 20 ? "opacity-100" : "opacity-0")}>
              Import <span className="text-white/45">→</span> <span className="font-mono text-[11px]" style={{ color: CYAN }}>{file}</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${importing * 100}%`, background: CYAN }} />
            </div>
            <p className={cn("mt-2 font-mono text-[11px] transition-opacity", importing >= 1 ? "opacity-100" : "opacity-0")}>
              01A <span className="text-white">{preset.name}</span> <Check className="inline size-3" style={{ color: CYAN }} />
            </p>
          </Pane>

          {/* 3. The unit */}
          <Pane on={phase === 2} label={unitName}>
            <div className="rounded-md bg-black px-2 py-1.5 text-center font-mono text-[10px] leading-tight">
              <span className="text-white/45">01A</span> <span className="text-white">{preset.name}</span>
              <span className="block" style={{ color: lit >= 0 ? parts[lit]?.color : "rgba(255,255,255,0.3)" }}>
                {lit >= 0 ? (parts[lit]?.name ?? "").toUpperCase() : "—"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {parts.map((s, i) => (
                <span key={s.id} className="flex flex-col items-center gap-1">
                  <span
                    className="size-8 rounded-full border-2 bg-gradient-to-b from-[#3a3f4a] to-[#1b1f27] transition-all duration-300"
                    style={
                      i === lit
                        ? { borderColor: s.color, boxShadow: `0 0 0 3px ${s.color}40, 0 0 18px -2px ${s.color}`, transform: "scale(1.08)" }
                        : { borderColor: `${s.color}55` }
                    }
                  />
                  <span className="max-w-full truncate font-mono text-[9px] uppercase text-white/60">{s.name}</span>
                </span>
              ))}
            </div>
          </Pane>
        </div>
      </HardwarePanel>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li
            key={title}
            className={cn(
              "rounded-xl border px-3.5 py-3 transition-colors duration-300",
              i === phase ? "border-pop/70 bg-pop/10" : "border-border bg-card",
            )}
          >
            <span className="font-mono text-[11px] text-pop">{i + 1}</span>
            <span className="ml-2 text-sm font-medium">{title}</span>
            <span className="mt-1 block text-xs leading-snug text-muted-foreground">{body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Pane({ on, label, children }: { on: boolean; label: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative min-h-[132px] overflow-hidden rounded-xl border p-3 transition-all duration-500",
        on ? "border-[#5ce1e6]/60 bg-white/[0.06] shadow-[0_0_30px_-12px_#5ce1e6]" : "border-white/10 bg-white/[0.02] opacity-70",
      )}
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      {children}
    </div>
  );
}

type Feature = { id: string; icon: typeof ListMusic; title: string; body: string };

const FEATURES: Feature[] = [
  { id: "setlist", icon: ListMusic, title: "Setlists", body: "Line up a whole set. Download every song in one zip, in order." },
  { id: "revise", icon: SlidersHorizontal, title: "Revise", body: "Too bright? Tap what's off and the tone is rebuilt around it." },
  { id: "effects", icon: ToggleRight, title: "Song parts or effects", body: "Switches play the song parts, or turn single effects on and off." },
  { id: "share", icon: Link2, title: "Share", body: "Send a preset to your bandmate as a link." },
];

/** What else Stomp Lab does, each tile acting itself out. Cycles on its own; tap one to stay on it. */
export function FeatureScene({ preset }: { preset: Preset }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (reduce || held) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % FEATURES.length), 3200);
    return () => window.clearInterval(id);
  }, [reduce, held]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FEATURES.map((f, i) => {
        const on = i === active;
        const Icon = f.icon;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              setHeld(true);
              setActive(i);
            }}
            className={cn(
              "group relative self-start overflow-hidden rounded-2xl border p-4 text-left transition-all duration-500",
              on ? "border-pop/70 bg-card shadow-[0_18px_40px_-24px_var(--color-pop)]" : "border-border bg-card/60",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("grid size-8 place-items-center rounded-lg transition-colors", on ? "bg-pop/15 text-pop" : "bg-secondary text-muted-foreground")}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{f.title}</span>
            </span>
            <span className="mt-2 block text-xs leading-snug text-muted-foreground">{f.body}</span>
            {on ? (
              <div className="sl-pop mt-3 min-h-[64px]" aria-hidden>
                <FeatureDemo id={f.id} preset={preset} />
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FeatureDemo({ id, preset }: { id: string; preset: Preset }) {
  const t = useTicks(30, false);
  if (id === "setlist") {
    const songs = [preset.song, "Teen Spirit", "Comfortably Numb"];
    return (
      <div className="flex items-center gap-3">
        <ul className="flex-1 space-y-1">
          {songs.map((s, i) => (
            <li
              key={s}
              className="truncate rounded-md bg-secondary/70 px-2 py-1 text-[11px] transition-all duration-500"
              style={{ transform: t > 8 + i * 4 ? "translateX(12px)" : "none", opacity: t > 8 + i * 4 ? 0.35 : 1 }}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ul>
        <span className={cn("rounded-lg border px-2 py-3 font-mono text-[10px] transition-all duration-500", t > 22 ? "border-pop text-pop" : "border-border text-muted-foreground")}>
          set.zip
        </span>
      </div>
    );
  }
  if (id === "revise") {
    const v = t < 10 ? 6.4 : Math.max(4.6, 6.4 - (t - 10) * 0.12);
    return (
      <div className="flex items-center gap-3">
        <span className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", t >= 6 ? "border-pop bg-pop/15 text-pop" : "border-border")}>Too bright</span>
        <span className="relative grid size-12 place-items-center">
          <svg viewBox="0 0 40 40" className="absolute inset-0">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="var(--color-pop)"
              strokeWidth="4"
              strokeDasharray={`${(v / 10) * 100} 100`}
              pathLength={100}
              transform="rotate(135 20 20)"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-mono text-[11px]">{v.toFixed(1)}</span>
        </span>
        <span className="text-xs text-muted-foreground">Treble</span>
      </div>
    );
  }
  if (id === "effects") {
    const fx = t >= 12;
    const labels = fx ? ["Drive", "Boost", "Delay"] : preset.snapshots.slice(0, 3).map((s) => s.name);
    return (
      <div className="space-y-2">
        <div className="inline-grid grid-cols-2 rounded-full bg-secondary p-0.5 text-[11px]">
          <span className={cn("rounded-full px-2.5 py-1 transition-colors", !fx && "bg-primary text-primary-foreground")}>Song parts</span>
          <span className={cn("rounded-full px-2.5 py-1 transition-colors", fx && "bg-primary text-primary-foreground")}>Effects</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {labels.map((l) => (
            <span key={l} className="sl-pop truncate rounded-md border border-border px-2 py-1 text-center font-mono text-[10px] uppercase">
              {l}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate rounded-lg border border-border bg-secondary/60 px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
        stomplab.app/s/{preset.name.toLowerCase().replace(/\W+/g, "")}
      </span>
      <span className={cn("flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium transition-all", t >= 10 ? "bg-pop/15 text-pop" : "bg-secondary")}>
        {t >= 10 ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
        {t >= 10 ? "Copied" : "Copy"}
      </span>
    </div>
  );
}
