import type { ReactNode } from "react";

/** A greyed, non-interactive preview shown above the price card. */
function Sample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2" aria-hidden>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="pointer-events-none select-none space-y-2 opacity-60 grayscale">{children}</div>
    </div>
  );
}

const SET = [
  { song: "Smells Like Teen Spirit", artist: "Nirvana", unit: "HX Stomp", note: "F minor · standard" },
  { song: "Enter Sandman", artist: "Metallica", unit: "HX Stomp", note: "E minor · standard" },
  { song: "Comfortably Numb", artist: "Pink Floyd", unit: "HX Stomp", note: "B minor · standard" },
  { song: "Where the Streets Have No Name", artist: "U2", unit: "HX Stomp", note: "D major · standard" },
];

export function SampleSetlist() {
  return (
    <Sample label="Sample: Sunday set">
      <ol className="space-y-2">
        {SET.map((s, i) => (
          <li key={s.song} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.song}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {s.artist} · {s.unit} · {s.note}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Sample>
  );
}

const GEAR = [
  { kind: "Guitar", name: "Fender Stratocaster", note: "Single coils" },
  { kind: "Amp", name: "Marshall JCM800", note: "Crunch channel" },
  { kind: "Pedal", name: "Ibanez TS808", note: "Overdrive" },
  { kind: "Pedal", name: "Boss DS-1", note: "Distortion" },
];

export function SampleGear() {
  return (
    <Sample label="Sample: gear locker">
      <ul className="space-y-2">
        {GEAR.map((g) => (
          <li key={g.name} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.kind}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{g.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{g.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </Sample>
  );
}
