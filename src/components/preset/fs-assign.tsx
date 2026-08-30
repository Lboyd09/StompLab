import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset } from "@/data/types";
import { blockModel, deviceFor, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";

type FsMode = "stomp" | "snapshot" | "preset";

type Props = {
  preset: Preset;
  fsIndex: number;
  fsMode: FsMode;
  onAssign: (index: number, patch: Partial<FootswitchAssign> | null) => void;
  onReset?: () => void;
};

export function FsAssignPanel({ preset, fsIndex, fsMode, onAssign, onReset }: Props) {
  const device = deviceFor(preset);
  const xl = device.footswitches === 8;
  const current = preset.footswitches.find((f) => f.index === fsIndex);
  const locked = xl && (fsIndex === 7 || fsIndex === 8);
  const snapshotMode = fsMode === "snapshot";

  function set(patch: Partial<FootswitchAssign>) {
    onAssign(fsIndex, patch);
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold">
            {locked
              ? fsIndex === 7
                ? "MODE"
                : "TAP"
              : `Switch ${fsIndex}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {locked
              ? "These two stay MODE and TAP on the XL."
              : snapshotMode
                ? "Tap a switch on the replica, then tap a song section."
                : "Tap a switch on the replica, then tap an effect."}
          </p>
        </div>
        {onReset ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={onReset}
          >
            Reset to original
          </button>
        ) : null}
      </div>

      {locked ? null : fsMode === "preset" ? (
        <p className="text-sm text-muted-foreground">
          Preset mode walks banks on the hardware. Switch to Snapshot or Stomp to assign this switch.
        </p>
      ) : snapshotMode ? (
        <div className="flex flex-wrap gap-2">
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
                  "h-10 rounded-full px-4 text-sm",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {s.name}
              </button>
            );
          })}
          <button
            type="button"
            className="h-10 rounded-full px-4 text-sm text-muted-foreground"
            onClick={() => onAssign(fsIndex, null)}
          >
            Empty
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sortedBlocks(preset).map((b) => {
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
                  "h-10 rounded-full px-4 text-sm",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {model.name}
              </button>
            );
          })}
          <button
            type="button"
            className="h-10 rounded-full px-4 text-sm text-muted-foreground"
            onClick={() => onAssign(fsIndex, null)}
          >
            Empty
          </button>
        </div>
      )}
    </section>
  );
}
