import { CATEGORY_MAP } from "@/data/categories";
import type { Preset, StompBlock } from "@/data/types";
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
  onScribbleTap?: (index: number) => void;
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
        "relative flex h-7 min-w-7 shrink-0 flex-col overflow-hidden rounded-[2px] border text-left",
        selected ? "border-white" : "border-black/70",
        !block.enabled && "opacity-35",
      )}
      style={{ background: "#14181c", width: 36 }}
    >
      <span className="h-[3px] w-full" style={{ background: color }} />
      <span className="flex flex-1 items-center justify-center px-0.5 font-mono text-[7px] font-semibold uppercase tracking-wide text-zinc-100">
        {model?.abbrev ?? "—"}
      </span>
    </button>
  );
}

function scribblesFor(preset: Preset, fsMode: FsMode, xl: boolean): Scribble[] {
  const dim = "#5a5e62";
  const indices = xl ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
  return indices.map((index) => {
    const assign = preset.footswitches.find((f) => f.index === index);
    if (fsMode === "preset") {
      const labels = xl
        ? { 1: "▲", 2: "C", 3: "D", 4: "▼", 5: "A", 6: "B" }
        : { 1: "PRESET-", 2: "TAP", 3: "PRESET+" };
      return { index, label: labels[index as keyof typeof labels] ?? "", color: dim };
    }
    if (assign) return { index, label: assign.label.slice(0, 8), color: assign.color };
    return { index, label: "—", color: dim };
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
  const layout = device.layout;
  const xl = layout === "xl";
  const showLcdScribbles = layout === "stomp" || layout === "xl";
  const strips = showLcdScribbles ? scribblesFor(preset, fsMode, xl) : [];
  const topStrips = xl ? strips.slice(0, 3) : [];
  const bottomStrips = xl ? strips.slice(3, 6) : strips;

  return (
    <div
      className={cn(
        "hx-lcd relative overflow-hidden",
        (layout === "floor" || layout === "lt") && "hx-lcd-wide",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="rounded-[2px] bg-zinc-100 px-1 py-[1px] font-mono text-[10px] font-semibold text-zinc-900">
            01A
          </span>
          <span className="truncate font-medium text-[11px] tracking-wide">{preset.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-zinc-400">
          <span className="uppercase tracking-wider text-zinc-500">
            {fsMode === "snapshot" ? "snap" : fsMode}
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
          <div className="relative flex min-h-10 flex-1 items-center">
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

      {view === "tuner" || !showLcdScribbles ? null : (
        <div className="mt-auto">
          {topStrips.length ? (
            <ScribbleRow items={topStrips} active={assignFsIndex} onTap={onScribbleTap} />
          ) : null}
          <ScribbleRow items={bottomStrips} active={assignFsIndex} onTap={onScribbleTap} />
        </div>
      )}
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
