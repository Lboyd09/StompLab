import { GUITAR_ROLE_COPY, type GuitarRole } from "@/lib/guitar-role";
import { cn } from "@/lib/utils";

export function GuitarRolePicker({
  value,
  onChange,
  compact,
}: {
  value: GuitarRole;
  onChange: (role: GuitarRole) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? (
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">What you play on this song</p>
      ) : (
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Part</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {(["rhythm", "lead", "both"] as const).map((id) => {
          const copy = GUITAR_ROLE_COPY[id];
          const on = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "min-h-14 rounded-2xl border px-3 py-3 text-left transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <span className="block font-display text-base font-semibold uppercase tracking-tight">{copy.label}</span>
              <span className={cn("mt-1 block text-[11px] leading-snug", on ? "text-primary-foreground/80" : "")}>
                {copy.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
