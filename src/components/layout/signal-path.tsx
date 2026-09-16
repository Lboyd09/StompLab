import { cn } from "@/lib/utils";

const NODES = [
  { n: "01", title: "Type a song", hint: "Title and artist. That’s the whole brief." },
  { n: "02", title: "We research the record", hint: "Gear, knobs, and snapshots for your unit." },
  { n: "03", title: "You import the file", hint: "HX Edit or POD Go Edit → File → Import." },
] as const;

/** Same 01–02–03 as the Lab landing. */
export function SignalPath({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {NODES.map((step) => (
        <li key={step.n} className="sl-card rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-pop">{step.n}</p>
          <p className="mt-3 font-display text-lg font-semibold uppercase leading-none tracking-tight">{step.title}</p>
          <p className="mt-2 text-sm leading-snug text-muted-foreground">{step.hint}</p>
        </li>
      ))}
    </ol>
  );
}
