import { researchLabel } from "@/lib/research-progress";

export function ResearchProgress({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(99, Math.round(pct)));
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{researchLabel(clamped)}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">{clamped}%</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
