import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset, StompBlock } from "@/data/types";
import { blockModel, deviceFor, dspLoad, formatParam, paramEntries, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";

type LcdView = "play" | "edit" | "tuner" | "assign";
type FsMode = "stomp" | "snapshot" | "preset";

type Props = {
  preset: Preset;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  view: LcdView;
  fsMode: FsMode;
  paramPage: number;
  activeSnapshot: number;
  assignFsIndex: number;
  showDsp?: boolean;
  onToggleBlock?: (id: string) => void;
  onScribbleTap?: (index: number) => void;
  onAssign?: (index: number, patch: Partial<FootswitchAssign>) => void;
};

type Scribble = { index: number; label: string; color: string };

function BlockChip({
  block,
  selected,
  onClick,
}: {
  block: StompBlock;
  selected: boolean;
  onClick: () => void;
}) {
  const model = blockModel(block);
  const cat = model ? CATEGORY_MAP[model.category] : null;
  const color = cat?.lcd ?? "#9aa3ad";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-8 min-w-8 shrink-0 flex-col overflow-hidden rounded-[2px] border text-left",
        selected ? "border-white" : "border-black/70",
        !block.enabled && "opacity-35",
      )}
      style={{ background: "#14181c", width: 40 }}
    >
      <span className="h-[4px] w-full" style={{ background: color }} />
      <span className="flex flex-1 items-center justify-center px-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-zinc-100">
        {model?.abbrev ?? "—"}
      </span>
    </button>
  );
}

function scribblesFor(preset: Preset, fsMode: FsMode, xl: boolean): Scribble[] {
  const count = xl ? 6 : 3;
  const dim = "#5a5e62";
  const indices = xl ? [4, 5, 6, 1, 2, 3] : [1, 2, 3];
  return indices.slice(0, count).map((index) => {
    if (fsMode === "snapshot") {
      const snap = preset.snapshots[index - 1];
      return snap
        ? { index, label: snap.name.slice(0, 8).toUpperCase(), color: snap.color }
        : { index, label: "—", color: dim };
    }
    if (fsMode === "preset") {
      const labels = xl
        ? { 1: "BANK-", 2: "A", 3: "B", 4: "BANK+", 5: "PRESET-", 6: "PRESET+" }
        : { 1: "PRESET-", 2: "TAP", 3: "PRESET+" };
      return { index, label: labels[index as keyof typeof labels] ?? `FS${index}`, color: dim };
    }
    const assign = preset.footswitches.find((f) => f.index === index);
    return assign
      ? { index, label: assign.label.slice(0, 8), color: assign.color }
      : { index, label: `FS${index}`, color: dim };
  });
}

export function LcdScreen({
  preset,
  selectedBlockId,
  onSelectBlock,
  view,
  fsMode,
  paramPage,
  activeSnapshot,
  assignFsIndex,
  showDsp = true,
  onScribbleTap,
  onAssign,
}: Props) {
  const blocks = sortedBlocks(preset);
  const selected = blocks.find((b) => b.id === selectedBlockId) ?? blocks[0];
  const model = selected ? blockModel(selected) : undefined;
  const params = selected ? paramEntries(selected) : [];
  const pageCount = Math.max(1, Math.ceil(params.length / 3));
  const page = ((paramPage % pageCount) + pageCount) % pageCount;
  const pageParams = params.slice(page * 3, page * 3 + 3);
  const device = deviceFor(preset);
  const load = dspLoad(preset);
  const snap = preset.snapshots[activeSnapshot];
  const xl = device.footswitches === 8;
  const strips = scribblesFor(preset, view === "assign" ? "stomp" : fsMode, xl);
  const topStrips = xl ? strips.slice(0, 3) : [];
  const bottomStrips = xl ? strips.slice(3, 6) : strips;

  return (
    <div className="hx-lcd relative overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="rounded-[2px] bg-zinc-100 px-1 py-[1px] font-mono text-[10px] font-semibold text-zinc-900">
            01A
          </span>
          <span className="truncate font-medium text-[11px] tracking-wide">{preset.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-zinc-400">
          <span className="uppercase tracking-wider text-zinc-500">
            {view === "assign" ? "assign" : fsMode === "snapshot" ? "snap" : fsMode}
          </span>
          <span className="tabular-nums">{preset.tempo}</span>
          {showDsp ? (
            <span
              className={cn(
                "tabular-nums",
                load > 90 ? "text-red-400" : load > 75 ? "text-amber-300" : "text-emerald-400",
              )}
            >
              {load}%
            </span>
          ) : null}
        </div>
      </div>

      {view === "tuner" ? (
        <TunerView />
      ) : view === "assign" ? (
        <AssignView
          preset={preset}
          fsIndex={assignFsIndex}
          onAssign={onAssign}
        />
      ) : view === "edit" && selected && model ? (
        <div className="flex flex-1 flex-col px-2 pt-2">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: CATEGORY_MAP[model.category].lcd }}
              />
              <span className="truncate text-[11px] font-medium">{model.name}</span>
            </div>
            <span className="font-mono text-[9px] text-zinc-500">
              {page + 1}/{pageCount}
            </span>
          </div>
          <p className="mb-2 line-clamp-2 text-[9px] leading-snug text-zinc-500">Based on {model.basedOn}</p>
          <div className="mt-auto grid grid-cols-3 gap-1 pb-1">
            {pageParams.map((p) => (
              <div key={p.name} className="text-center">
                <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{p.name}</div>
                <div className="font-mono text-[12px] tabular-nums">{formatParam(p.value)}</div>
              </div>
            ))}
            {Array.from({ length: 3 - pageParams.length }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-2 pt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            <span>In</span>
            <span>{snap ? snap.name : "Play"}</span>
            <span>Out</span>
          </div>
          <div className="relative flex min-h-11 flex-1 items-center">
            <div className="hx-path-line absolute inset-x-1 top-1/2 h-px -translate-y-1/2" />
            <div className="relative flex w-full items-center gap-1 overflow-x-auto">
              {blocks.map((b) => (
                <BlockChip
                  key={b.id}
                  block={b}
                  selected={b.id === (selectedBlockId ?? selected?.id)}
                  onClick={() => onSelectBlock(b.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "tuner" ? null : (
        <div className="mt-auto">
          {topStrips.length ? (
            <ScribbleRow items={topStrips} active={view === "assign" ? assignFsIndex : undefined} onTap={onScribbleTap} />
          ) : null}
          <ScribbleRow items={bottomStrips} active={view === "assign" ? assignFsIndex : undefined} onTap={onScribbleTap} />
        </div>
      )}
    </div>
  );
}

function AssignView({
  preset,
  fsIndex,
  onAssign,
}: {
  preset: Preset;
  fsIndex: number;
  onAssign?: (index: number, patch: Partial<FootswitchAssign>) => void;
}) {
  const current = preset.footswitches.find((f) => f.index === fsIndex);
  const blocks = sortedBlocks(preset);

  function set(patch: Partial<FootswitchAssign>) {
    onAssign?.(fsIndex, patch);
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5 overflow-hidden px-2 pt-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          FS{fsIndex} · {current?.label ?? "empty"}
        </span>
        <span className="font-mono text-[9px] text-zinc-500">tap a switch, then a block</span>
      </div>
      <div className="flex flex-wrap gap-1">
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
                "rounded-[2px] border px-1.5 py-0.5 font-mono text-[8px] uppercase",
                on ? "border-white text-zinc-100" : "border-white/15 text-zinc-400",
              )}
            >
              {model.abbrev}
            </button>
          );
        })}
      </div>
      {preset.snapshots.length ? (
        <div className="flex flex-wrap gap-1">
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
                  "rounded-[2px] border px-1.5 py-0.5 font-mono text-[8px] uppercase",
                  on ? "border-white text-zinc-100" : "border-white/15 text-zinc-400",
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-1 pb-1">
        <button
          type="button"
          className="rounded-[2px] border border-white/15 px-1.5 py-0.5 font-mono text-[8px] uppercase text-zinc-400"
          onClick={() =>
            set({ action: "tap", label: "TAP", color: "#c5c9c2", targetBlockId: undefined, snapshotId: undefined, notes: "Tap tempo" })
          }
        >
          Tap
        </button>
        <button
          type="button"
          className="rounded-[2px] border border-white/15 px-1.5 py-0.5 font-mono text-[8px] uppercase text-zinc-400"
          onClick={() =>
            set({ action: "tuner", label: "TUNER", color: "#22e07a", targetBlockId: undefined, snapshotId: undefined, notes: "Mute tuner" })
          }
        >
          Tuner
        </button>
        <button
          type="button"
          className="rounded-[2px] border border-white/15 px-1.5 py-0.5 font-mono text-[8px] uppercase text-zinc-400"
          onClick={() =>
            set({ action: "mode", label: "MODE", color: "#5a5e62", targetBlockId: undefined, snapshotId: undefined, notes: "Cycle Stomp / Snapshot / Preset" })
          }
        >
          Mode
        </button>
      </div>
    </div>
  );
}

function ScribbleRow({
  items,
  active,
  onTap,
}: {
  items: Scribble[];
  active?: number;
  onTap?: (index: number) => void;
}) {
  return (
    <div
      className="grid border-t border-white/10"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
    >
      {items.map((fs) => (
        <button
          key={`${fs.index}-${fs.label}`}
          type="button"
          onClick={() => onTap?.(fs.index)}
          className={cn(
            "flex flex-col items-center border-l border-white/5 px-1 py-1 first:border-l-0",
            active === fs.index && "bg-white/10",
          )}
        >
          <span className="mb-0.5 size-1.5 rounded-full" style={{ background: fs.color }} />
          <span className="w-full truncate text-center font-mono text-[8px] uppercase tracking-wider text-zinc-300">
            {fs.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function TunerView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <div className="font-mono text-3xl font-semibold tracking-widest">A</div>
      <div className="relative h-1.5 w-40 rounded-full bg-zinc-800">
        <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400" />
      </div>
      <div className="font-mono text-[10px] text-zinc-500">440 Hz · in tune</div>
    </div>
  );
}
