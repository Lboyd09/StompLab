import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Preset, StompDevice } from "@/data/types";
import { cn } from "@/lib/utils";
import { rigBlocks, rigKnobs, type RigBlock } from "./demo-rig";

/** True when the OS or the app's own Motion setting asks for less movement. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => readReduced());
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(readReduced());
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);
  return reduce;
}

function readReduced(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.motion === "reduce" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]+[.!?]/);
  return (m ? m[0] : text).trim();
}

/** Always-dark "hardware" surface so the pedal colours read the same in the light and dark themes. */
export function HardwarePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0e1117] p-4 text-[#f3efe6] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] sm:p-6",
        className,
      )}
    >
      <span className="sl-form-bar" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_100%_0%,rgba(92,225,230,0.10),transparent_60%),radial-gradient(90%_60%_at_0%_100%,rgba(61,126,255,0.12),transparent_60%)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function Chain({ blocks, shown = blocks.length }: { blocks: RigBlock[]; shown?: number }) {
  return (
    <ol className="relative grid gap-1.5 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))` }} aria-label="Signal chain">
      <span aria-hidden className="absolute left-2 right-2 top-[26px] h-px bg-white/15 sm:top-[34px]" />
      {blocks.map((b, i) => {
        const visible = i < shown;
        return (
          <li
            key={b.id}
            className={cn(
              "relative flex min-w-0 flex-col items-center text-center transition-[opacity,transform] duration-500 ease-[var(--ease-out)]",
              visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            )}
            aria-hidden={!visible}
          >
            <span
              className={cn(
                "relative grid h-[52px] w-full max-w-[84px] place-items-center rounded-xl border transition-all duration-300 sm:h-[68px]",
                b.on ? "border-transparent" : "border-white/10 bg-white/[0.03]",
              )}
              style={b.on ? { background: `color-mix(in oklab, ${b.color} 22%, #0e1117)`, boxShadow: `0 0 0 1px ${b.color}, 0 0 22px -6px ${b.color}` } : undefined}
            >
              <span
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full transition-colors sm:right-2 sm:top-2 sm:size-2"
                style={{ background: b.on ? b.color : "rgba(255,255,255,0.15)" }}
                aria-hidden
              />
              <span className={cn("font-mono text-[10px] font-medium uppercase tracking-[0.14em] sm:text-xs", b.on ? "text-white" : "text-white/35")}>{b.short}</span>
            </span>
            <span className={cn("mt-1.5 line-clamp-2 w-full text-[10px] leading-tight sm:text-xs", b.on ? "text-white/85" : "text-white/35")}>{b.name}</span>
            <span className="sr-only">{b.on ? "on" : "off"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Footswitches({
  preset,
  active,
  onPick,
  tried,
}: {
  preset: Preset;
  active: number;
  onPick?: (i: number) => void;
  tried?: Set<number>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4" role={onPick ? "group" : undefined} aria-label={onPick ? "Footswitches" : undefined}>
      {preset.snapshots.slice(0, 3).map((s, i) => {
        const on = i === active;
        const face = (
          <>
            <span
              className={cn(
                "grid size-12 place-items-center rounded-full border-2 transition-all duration-300 sm:size-16",
                on ? "scale-105" : "border-white/15",
              )}
              style={on ? { borderColor: s.color, boxShadow: `0 0 0 4px color-mix(in oklab, ${s.color} 25%, transparent), 0 0 28px -4px ${s.color}` } : undefined}
            >
              <span className="size-7 rounded-full bg-gradient-to-b from-[#3a3f4a] to-[#1b1f27] shadow-inner sm:size-10" />
            </span>
            <span
              className={cn("mt-2 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] sm:text-xs", on ? "text-white" : "text-white/50")}
            >
              {s.name}
            </span>
            {tried ? (
              <span className={cn("mx-auto mt-1 block h-0.5 w-5 rounded-full", tried.has(i) ? "bg-[#5ce1e6]" : "bg-white/10")} aria-hidden />
            ) : null}
          </>
        );
        return onPick ? (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            aria-label={`${s.name} switch`}
            onClick={() => onPick(i)}
            className="flex min-h-11 flex-col items-center rounded-xl py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[#5ce1e6]"
          >
            {face}
          </button>
        ) : (
          <div key={s.id} className="flex flex-col items-center py-1.5">
            {face}
          </div>
        );
      })}
    </div>
  );
}

function Dial({ value, changed }: { value: number; changed: boolean }) {
  // 270-degree sweep, 0..10.
  const r = 15;
  const c = 2 * Math.PI * r;
  const sweep = 0.75 * c;
  const fill = (Math.max(0, Math.min(10, value)) / 10) * sweep;
  return (
    <svg viewBox="0 0 40 40" className="size-10 sm:size-12" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" strokeDasharray={`${sweep} ${c}`} strokeLinecap="round" transform="rotate(135 20 20)" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={changed ? "#5ce1e6" : "#3d7eff"}
        strokeWidth="3.5"
        strokeDasharray={`${fill} ${c}`}
        strokeLinecap="round"
        transform="rotate(135 20 20)"
        className="transition-[stroke-dasharray] duration-500 ease-[var(--ease-out)]"
      />
    </svg>
  );
}

/** Welcome reel: a song typed in, the record researched, the chain built, the switches lit. */
export function DemoReel({ preset, onTry }: { preset: Preset; onTry?: () => void }) {
  const reduce = useReducedMotion();
  const blocks = preset.blocks.length;
  const query = `${preset.song}`;
  const facts = useMemo(
    () =>
      ["Guitar", "Amp", "Pedal"]
        .map((role) => preset.originalGear.find((g) => g.role === role))
        .filter((g): g is NonNullable<typeof g> => Boolean(g))
        .slice(0, 3),
    [preset],
  );
  // Timeline in 100 ms ticks. END = everything on screen.
  const typeEnd = Math.ceil(query.length * 0.45);
  const factStart = typeEnd + 5;
  const chainStart = factStart + facts.length * 4 + 2;
  const switchStart = chainStart + blocks * 2 + 2;
  const END = switchStart + 2;
  const [t, setT] = useState(reduce ? END : 0);
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (reduce) {
      setT(END);
      return;
    }
    setT(0);
    const id = window.setInterval(() => {
      setT((n) => {
        if (n >= END) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [reduce, END]);

  useEffect(() => {
    if (reduce || manual || t < END) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % Math.min(3, preset.snapshots.length)), 1700);
    return () => window.clearInterval(id);
  }, [reduce, manual, t, END, preset.snapshots.length]);

  const typed = query.slice(0, Math.min(query.length, Math.floor(t / 0.45)));
  const typing = t < typeEnd;
  const factsShown = t < factStart ? 0 : Math.min(facts.length, Math.floor((t - factStart) / 4) + 1);
  const chainShown = t < chainStart ? 0 : Math.min(blocks, Math.floor((t - chainStart) / 2) + 1);
  const switchesOn = t >= switchStart;
  const rig = rigBlocks(preset, active);

  return (
    <HardwarePanel>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-4 sm:py-3" aria-hidden>
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" strokeLinecap="round" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm sm:text-base">
          {typed}
          {typing ? <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-[#5ce1e6]" /> : null}
          {!typing ? <span className="text-white/45"> · {preset.artist}</span> : null}
        </span>
        <span className={cn("shrink-0 rounded-md bg-[#3d7eff] px-2 py-1 text-[11px] font-medium transition-opacity", typing ? "opacity-40" : "opacity-100")}>Build</span>
      </div>
      <p className="sr-only">
        Example: {preset.song} by {preset.artist}. Stomp Lab finds the gear on the record and builds the chain with a switch for each part.
      </p>

      <div className="mt-4 min-h-[76px] space-y-1.5 sm:mt-5 sm:min-h-[92px]" aria-hidden>
        <p className={cn("font-mono text-[10px] uppercase tracking-[0.24em] text-[#5ce1e6] transition-opacity sm:text-[11px]", t >= factStart ? "opacity-100" : "opacity-0")}>
          {chainShown ? "On the record" : "Researching the record"}
        </p>
        {facts.map((g, i) => (
          <p
            key={g.role}
            className={cn(
              "flex min-w-0 gap-2 text-xs transition-[opacity,transform] duration-500 sm:text-sm",
              i < factsShown ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
            )}
          >
            <span className="w-12 shrink-0 text-white/40">{g.role}</span>
            <span className="min-w-0 truncate text-white/85">{g.name}</span>
          </p>
        ))}
      </div>

      <div className="mt-4 sm:mt-6">
        <Chain blocks={rig} shown={chainShown} />
      </div>

      <div className={cn("mt-4 border-t border-white/10 pt-4 transition-opacity duration-500 sm:mt-6 sm:pt-5", switchesOn ? "opacity-100" : "opacity-0")}>
        <Footswitches
          preset={preset}
          active={active}
          onPick={
            switchesOn
              ? (i) => {
                  setManual(true);
                  setActive(i);
                  onTry?.();
                }
              : undefined
          }
        />
      </div>
    </HardwarePanel>
  );
}

/** The "aha": tap a part of the song, watch pedals and knobs follow. */
export function TryRig({ preset, active, onPick, tried }: { preset: Preset; active: number; onPick: (i: number) => void; tried: Set<number> }) {
  const [previous, setPrevious] = useState<number | undefined>(undefined);
  const rig = rigBlocks(preset, active);
  const knobs = rigKnobs(preset, active, previous).slice(0, 6);
  const snap = preset.snapshots[active];
  return (
    <HardwarePanel>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#5ce1e6] sm:text-[11px]">Demo · {preset.song}</p>
        <p className="shrink-0 text-[11px] text-white/45">{preset.tempo} bpm</p>
      </div>
      <div className="mt-4 sm:mt-5">
        <Chain blocks={rig} />
      </div>

      <div className="mt-4 min-h-[118px] rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:mt-5 sm:min-h-[132px] sm:p-4" aria-live="polite">
        <p className="text-sm leading-snug text-white/90">
          <span className="font-medium" style={{ color: snap?.color }}>
            {snap?.name}:
          </span>{" "}
          {snap ? firstSentence(snap.notes) : ""}
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-6">
          {knobs.map((k) => (
            <li key={`${k.block}-${k.name}`} className="flex min-w-0 flex-col items-center text-center">
              <span className="relative grid place-items-center">
                <Dial value={k.value} changed={k.changed} />
                <span className={cn("absolute text-[11px] font-medium tabular-nums", k.changed ? "text-[#5ce1e6]" : "text-white")}>{k.value.toFixed(1)}</span>
              </span>
              <span className="mt-0.5 w-full truncate text-[10px] text-white/55">{k.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4 sm:mt-5 sm:pt-5">
        <Footswitches
          preset={preset}
          active={active}
          tried={tried}
          onPick={(i) => {
            setPrevious(active === i ? previous : active);
            onPick(i);
          }}
        />
      </div>
    </HardwarePanel>
  );
}

/** Simple silhouette of a unit: the screen and its footswitch grid. */
export function UnitArt({ device, className }: { device: StompDevice; className?: string }) {
  const n = device.footswitches;
  const rows = n > 4 ? 2 : 1;
  const cols = Math.ceil(n / rows);
  const pitch = 11;
  const w = Math.max(44, cols * pitch + 14);
  const h = rows === 2 ? 40 : 32;
  const screenW = device.layout === "floor" || device.layout === "lt" ? 22 : 14;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-auto", className)} aria-hidden>
      <rect x="0.75" y="0.75" width={w - 1.5} height={h - 1.5} rx="5" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x={(w - screenW) / 2} y="4.5" width={screenW} height="6" rx="1.5" fill="currentColor" fillOpacity="0.55" />
      {Array.from({ length: n }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = (w - (cols - 1) * pitch) / 2 + c * pitch;
        const y = rows === 2 ? 20 + r * 11 : 21;
        return <circle key={i} cx={x} cy={y} r="3.3" fill="currentColor" fillOpacity="0.8" />;
      })}
    </svg>
  );
}
