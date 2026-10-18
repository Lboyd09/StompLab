import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset } from "@/data/types";
import { blockModel, deviceFor, hxEditFsNumber, sortedBlocks } from "@/lib/preset-utils";
import { isAmpOrCab } from "@/lib/snapshot-sanitize";

type Props = {
  preset: Preset;
  onAssign: (index: number, patch: Partial<FootswitchAssign> | null) => void;
  onReset?: () => void;
};

/** Footswitches a player can put an effect on in Stomp mode, numbered as on the unit. */
export function stompSwitchIndices(preset: Preset): number[] {
  const device = deviceFor(preset);
  const n = device.layout === "stomp" ? 3 : device.layout === "xl" ? 6 : device.footswitches;
  return Array.from({ length: n }, (_, i) => i + 1).filter((i) => !(device.layout === "podgo" && i === 8));
}

/** Stomp mode: one row per footswitch, pick the effect it turns on and off. */
export function FsAssignPanel({ preset, onAssign, onReset }: Props) {
  const device = deviceFor(preset);
  const xl = device.layout === "xl";
  const blocks = sortedBlocks(preset).filter((b) => !isAmpOrCab(b.modelId) && blockModel(b));

  function assign(index: number, blockId: string) {
    if (!blockId) {
      onAssign(index, null);
      return;
    }
    const block = blocks.find((b) => b.id === blockId);
    const model = block ? blockModel(block) : undefined;
    if (!block || !model) return;
    onAssign(index, {
      action: "bypass",
      targetBlockId: block.id,
      snapshotId: undefined,
      label: model.abbrev,
      color: CATEGORY_MAP[model.category].lcd,
      notes: `Toggle ${model.name}`,
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold">Footswitches</h2>
          <p className="text-sm text-muted-foreground">
            Pick the effect each switch turns on and off. Switch 1 is top-left on the {device.name}.
          </p>
        </div>
        {onReset ? (
          <button
            type="button"
            className="min-h-11 text-xs text-muted-foreground underline underline-offset-2"
            onClick={onReset}
          >
            Reset to original
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {stompSwitchIndices(preset).map((index) => {
          const current = preset.footswitches.find((f) => f.index === index && f.action === "bypass");
          const block = current ? preset.blocks.find((b) => b.id === current.targetBlockId) : undefined;
          const color = block ? CATEGORY_MAP[blockModel(block)?.category ?? "drive"]?.lcd : undefined;
          return (
            <li key={index} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
              <label htmlFor={`fs-${index}`} className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-3 shrink-0 rounded-full border border-border"
                  style={{ background: color ?? "transparent" }}
                  aria-hidden
                />
                FS{hxEditFsNumber(index, xl)}
              </label>
              <select
                id={`fs-${index}`}
                value={block?.id ?? ""}
                onChange={(e) => assign(index, e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-2 text-base md:text-sm"
              >
                <option value="">Nothing</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {blockModel(b)?.name}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
