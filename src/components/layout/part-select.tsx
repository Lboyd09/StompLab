import type { GuitarRole } from "@/lib/guitar-role";

const OPTIONS: { id: Exclude<GuitarRole, "both">; label: string }[] = [
  { id: "rhythm", label: "Rhythm" },
  { id: "lead", label: "Lead" },
];

export function PartSelect({
  value,
  onChange,
}: {
  value: Exclude<GuitarRole, "both">;
  onChange: (role: Exclude<GuitarRole, "both">) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Guitar part</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Guitar part">
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
          ? "Lead guitarist only. A different guitar, amp, and pedals — not the rhythm chain louder."
          : "Rhythm guitarist only. The other player's lead tone is left out."}
      </p>
    </div>
  );
}