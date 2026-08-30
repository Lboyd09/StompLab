import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset } from "@/data/types";
import { blockModel, deviceFor, footswitchPlace, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

type Props = {
  preset: Preset;
  fsIndex: number;
  onSelect: (index: number) => void;
  onAssign: (index: number, patch: Partial<FootswitchAssign> | null) => void;
  onAutoEffects: () => void;
  onAutoSnapshots: () => void;
};

export function FsAssignPanel({
  preset,
  fsIndex,
  onSelect,
  onAssign,
  onAutoEffects,
  onAutoSnapshots,
}: Props) {
  const device = deviceFor(preset);
  const xl = device.footswitches === 8;
  const slots = xl ? 6 : 3;
  const current = preset.footswitches.find((f) => f.index === fsIndex);
  const blocks = sortedBlocks(preset);
  const locked = xl && (fsIndex === 7 || fsIndex === 8);

  function set(patch: Partial<FootswitchAssign>) {
    onAssign(fsIndex, patch);
    const next = fsIndex >= slots ? 1 : fsIndex + 1;
    onSelect(next);
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold">Set a switch</h2>
          <p className="text-xs text-muted-foreground">
            Tap a footswitch on the replica, then tap what it should do. That map is what the .hlx
            writes onto the unit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {preset.snapshots.length ? (
            <Button type="button" size="sm" variant="secondary" onClick={onAutoSnapshots}>
              Map song sections
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={onAutoEffects}>
            Map effects
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: slots }, (_, i) => i + 1).map((index) => {
          const f = preset.footswitches.find((x) => x.index === index);
          const on = index === fsIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs",
                on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {footswitchPlace(index, xl)}
              {f?.label ? ` · ${f.label}` : ""}
            </button>
          );
        })}
      </div>

      <p className="text-sm">
        <span className="font-medium">{footswitchPlace(fsIndex, xl)}</span>
        <span className="text-muted-foreground">
          {locked
            ? " — MODE and TAP stay those hardware jobs on the XL."
            : current
              ? ` — ${current.label}`
              : " — empty"}
        </span>
      </p>

      {locked ? null : (
        <>
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Toggle an effect</p>
            <div className="flex flex-wrap gap-1.5">
              {blocks.map((b) => {
                const model = blockModel(b);
                if (!model) return null;
                const on = current?.action === "bypass" && current.targetBlockId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      set({
                        action: "bypass",
                        targetBlockId: b.id,
                        snapshotId: undefined,
                        label: model.abbrev,
                        color: CATEGORY_MAP[model.category].lcd,
                        notes: `Toggle ${model.name}`,
                      })
                    }
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs",
                      on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
          </div>

          {preset.snapshots.length ? (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Recall a song section
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preset.snapshots.map((s) => {
                  const on = current?.action === "snapshot" && current.snapshotId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        set({
                          action: "snapshot",
                          snapshotId: s.id,
                          targetBlockId: undefined,
                          label: s.name.slice(0, 8).toUpperCase(),
                          color: s.color,
                          notes: `Recall ${s.name}`,
                        })
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs",
                        on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground"
              onClick={() =>
                set({
                  action: "tap",
                  label: "TAP",
                  color: "#c5c9c2",
                  targetBlockId: undefined,
                  snapshotId: undefined,
                  notes: "Tap tempo",
                })
              }
            >
              Tap tempo
            </button>
            <button
              type="button"
              className="rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground"
              onClick={() =>
                set({
                  action: "tuner",
                  label: "TUNER",
                  color: "#22e07a",
                  targetBlockId: undefined,
                  snapshotId: undefined,
                  notes: "Mute tuner",
                })
              }
            >
              Tuner
            </button>
            <button
              type="button"
              className="rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground"
              onClick={() => onAssign(fsIndex, null)}
            >
              Leave empty
            </button>
          </div>
        </>
      )}
    </section>
  );
}
