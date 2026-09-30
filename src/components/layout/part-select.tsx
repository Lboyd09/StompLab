import type { GuitarRole } from "@/lib/guitar-role";

const OPTIONS: { id: GuitarRole; label: string }[] = [
  { id: "rhythm", label: "Rhythm" },
  { id: "both", label: "Both" },
  { id: "lead", label: "Lead" },
];

export function PartSelect({
  value,
  onChange,
}: {
  value: GuitarRole;
  onChange: (role: GuitarRole) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Guitar part</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Guitar part">
        {OPTIONS.map((option) => {
          const on = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.id)}
              className={
                on
                  ? "h-11 rounded-md border border-foreground bg-foreground text-sm font-medium text-background"
                  : "h-11 rounded-md border border-border bg-card text-sm"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {value === "lead"
          ? "Lead and solo only. A rhythm or chug snapshot is left out."
          : value === "rhythm"
            ? "Rhythm only. A lead or solo snapshot is left out."
            : "If the song has a rhythm guitar and a lead, both land on their own snapshots."}
      </p>
    </div>
  );
}
