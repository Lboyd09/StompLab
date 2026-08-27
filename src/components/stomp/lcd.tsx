import { CATEGORY_MAP } from "@/data/categories";
import type { Preset, StompBlock } from "@/data/types";
import { blockModel, deviceFor, dspLoad, formatParam, paramEntries, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";

type LcdView = "play" | "edit" | "tuner";
type FsMode = "stomp" | "snapshot" | "preset";

type Props = {
  preset: Preset;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  view: LcdView;
  fsMode: FsMode;
  paramPage: number;
  activeSnapshot: number;
  onToggleBlock?: (id: string) => void;
};

type Scribble = { label: string; color: string };

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
  const count = xl ? 8 : 3;
  const dim = "#5a5e62";
  if (fsMode === "snapshot") {
    return Array.from({ length: count }, (_, i) => {
      const snap = preset.snapshots[i];
      return snap
        ? { label: snap.name.slice(0, 8).toUpperCase(), color: snap.color }
        : { label: "—", color: dim };
    });
  }
  if (fsMode === "preset") {
    if (xl) {
      return [
        { label: "PRESET-", color: dim },
        { label: "PRESET+", color: dim },
        { label: "TAP", color: "#c5c9c2" },
        { label: "TUNER", color: "#7dff9a" },
        { label: "BANK-", color: dim },
        { label: "BANK+", color: dim },
        { label: "MODE", color: dim },
        { label: "MENU", color: dim },
      ];
    }
    return [
      { label: "PRESET-", color: dim },
      { label: "TAP", color: "#c5c9c2" },
      { label: "PRESET+", color: dim },
    ];
  }
  return Array.from({ length: count }, (_, i) => {
    const assign = preset.footswitches.find((f) => f.index === i + 1);
    return assign
      ? { label: assign.label.slice(0, 8), color: assign.color }
      : { label: `FS${i + 1}`, color: dim };
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
  const strips = scribblesFor(preset, fsMode, xl);
  const topStrips = xl ? strips.slice(4, 8) : [];
  const bottomStrips = xl ? strips.slice(0, 4) : strips;

  return (
    <div className="hx-lcd relative overflow-hidden text-zinc-100">
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="rounded-[2px] bg-zinc-100 px-1 py-[1px] font-mono text-[10px] font-semibold text-zinc-900">
            01A
          </span>
          <span className="truncate font-medium text-[11px] tracking-wide">{preset.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-zinc-400">
          <span className="uppercase tracking-wider text-zinc-500">{fsMode === "snapshot" ? "snap" : fsMode}</span>
          <span className="tabular-nums">{preset.tempo}</span>
          <span
            className={cn(
              "tabular-nums",
              load > 90 ? "text-red-400" : load > 75 ? "text-amber-300" : "text-emerald-400",
            )}
          >
            {load}%
          </span>
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
          {topStrips.length ? <ScribbleRow items={topStrips} /> : null}
          <ScribbleRow items={bottomStrips} />
        </div>
      )}
    </div>
  );
}

function ScribbleRow({ items }: { items: Scribble[] }) {
  return (
    <div
      className="grid border-t border-white/10"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
    >
      {items.map((fs, i) => (
        <div
          key={`${fs.label}-${i}`}
          className="flex flex-col items-center border-l border-white/5 px-1 py-1 first:border-l-0"
        >
          <span className="mb-0.5 size-1.5 rounded-full" style={{ background: fs.color }} />
          <span className="w-full truncate text-center font-mono text-[8px] uppercase tracking-wider text-zinc-300">
            {fs.label}
          </span>
        </div>
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
