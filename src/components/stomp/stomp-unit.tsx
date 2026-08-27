import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Preset } from "@/data/types";
import { deviceFor, paramEntries, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { Knob } from "./knob";
import { LcdScreen } from "./lcd";

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
  onParamPage: (page: number) => void;
  onView: (view: LcdView) => void;
  onFsMode: (mode: FsMode) => void;
  onSnapshot: (index: number) => void;
  onChangeParam: (blockId: string, name: string, value: number) => void;
  onToggleBlock: (blockId: string) => void;
};

const FS_CYCLE: FsMode[] = ["stomp", "snapshot", "preset"];

export function StompUnit({
  preset,
  selectedBlockId,
  onSelectBlock,
  view,
  fsMode,
  paramPage,
  activeSnapshot,
  onParamPage,
  onView,
  onFsMode,
  onSnapshot,
  onChangeParam,
  onToggleBlock,
}: Props) {
  const device = deviceFor(preset);
  const xl = device.footswitches === 8;
  const blocks = sortedBlocks(preset);
  const selected = blocks.find((b) => b.id === selectedBlockId) ?? blocks[0];
  const params = selected ? paramEntries(selected) : [];
  const pageCount = Math.max(1, Math.ceil(params.length / 3));
  const page = ((paramPage % pageCount) + pageCount) % pageCount;
  const pageParams = params.slice(page * 3, page * 3 + 3);
  const [volume, setVolume] = useState(7);
  const lastHome = useRef(0);

  const switches = useMemo(() => {
    return Array.from({ length: device.footswitches }, (_, i) => {
      const assign = preset.footswitches.find((f) => f.index === i + 1);
      return { index: i + 1, assign };
    });
  }, [device.footswitches, preset.footswitches]);

  function cycleMode(dir: 1 | -1) {
    const i = FS_CYCLE.indexOf(fsMode);
    onFsMode(FS_CYCLE[(i + dir + FS_CYCLE.length) % FS_CYCLE.length]);
  }

  function onPage(dir: 1 | -1) {
    if (view === "edit") {
      onParamPage(page + dir);
      return;
    }
    cycleMode(dir);
  }

  function onHome() {
    lastHome.current = Date.now();
    if (view === "tuner") {
      onView("play");
      return;
    }
    if (view === "edit") {
      onView("play");
      onSelectBlock(null);
      return;
    }
    onView("edit");
  }

  function onAction() {
    if (Date.now() - lastHome.current < 900) {
      toast.success("Saved. On a real Stomp, Home + Action writes the preset.");
      return;
    }
    if (view === "play") {
      onView("tuner");
      return;
    }
    if (selected) onToggleBlock(selected.id);
  }

  function cycleBlock(dir: 1 | -1) {
    if (!blocks.length) return;
    const cur = selectedBlockId ?? blocks[0].id;
    const i = Math.max(0, blocks.findIndex((b) => b.id === cur));
    const next = blocks[(i + dir + blocks.length) % blocks.length];
    onSelectBlock(next.id);
  }

  function pressFs(index: number) {
    if (view === "tuner") {
      onView("play");
      return;
    }
    if (fsMode === "snapshot") {
      const snap = preset.snapshots[index - 1];
      if (snap) onSnapshot(index - 1);
      return;
    }
    if (fsMode === "preset") {
      const tapIndex = xl ? 3 : 2;
      const tunerIndex = xl ? 4 : 2;
      if (index === tapIndex || index === tunerIndex) onView("tuner");
      return;
    }
    const assign = preset.footswitches.find((f) => f.index === index);
    if (!assign) return;
    if (assign.action === "tuner") {
      onView("tuner");
      return;
    }
    if (assign.action === "snapshot") {
      const idx = preset.snapshots.findIndex((s) => s.id === assign.snapshotId);
      onSnapshot(idx >= 0 ? idx : index - 1);
      return;
    }
    if (assign.action === "bypass" && assign.targetBlockId) {
      onToggleBlock(assign.targetBlockId);
    }
  }

  const topRow = xl ? switches.slice(4, 8) : [];
  const bottomRow = xl ? switches.slice(0, 4) : switches;

  return (
    <div className="overflow-x-auto">
      <div className={cn("hx-chassis mx-auto w-full", xl ? "max-w-[560px] min-w-[320px]" : "max-w-[440px] min-w-[300px]")}>
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="hx-silk">Line 6</span>
          <span className="hx-silk">{device.name}</span>
        </div>

        <div className="flex items-stretch gap-2 sm:gap-3">
          {xl ? (
            <div className="hidden w-4 shrink-0 sm:block" />
          ) : (
            <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1">
              <Knob label="Volume" value={volume} onChange={setVolume} size="md" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <LcdScreen
              preset={preset}
              selectedBlockId={selectedBlockId}
              onSelectBlock={(id) => {
                onSelectBlock(id);
                onView("edit");
              }}
              view={view}
              fsMode={fsMode}
              paramPage={page}
              activeSnapshot={activeSnapshot}
              onToggleBlock={onToggleBlock}
            />
          </div>

          <div className="flex w-[52px] shrink-0 flex-col items-center gap-1 pt-0.5">
            <HwBtn onClick={onHome}>Home</HwBtn>
            <HwBtn onClick={onAction}>Action</HwBtn>
            <Knob
              label="Upper"
              value={blocks.length ? ((blocks.findIndex((b) => b.id === selected?.id) + 1) / blocks.length) * 10 : 0}
              size="sm"
              onPress={() => cycleBlock(1)}
            />
            <Knob
              label="Lower"
              value={
                preset.snapshots.length
                  ? ((activeSnapshot + 1) / preset.snapshots.length) * 10
                  : 0
              }
              size="sm"
              onPress={() => {
                if (preset.snapshots.length) {
                  onSnapshot((activeSnapshot + 1) % preset.snapshots.length);
                }
              }}
            />
            <div className="mt-0.5 flex gap-0.5">
              <HwBtn onClick={() => onPage(-1)}>{"<"}</HwBtn>
              <HwBtn onClick={() => onPage(1)}>{">"}</HwBtn>
            </div>
            <span className="hx-silk">Page</span>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-center gap-6 sm:gap-8">
          {([0, 1, 2] as const).map((i) => {
            const p = pageParams[i];
            return (
              <Knob
                key={p?.name ?? `empty-${i}`}
                label={p?.name ?? "—"}
                value={p?.value ?? 0}
                disabled={!p || !selected}
                onChange={
                  p && selected
                    ? (v) => {
                        if (view !== "edit") onView("edit");
                        onChangeParam(selected.id, p.name, v);
                      }
                    : undefined
                }
              />
            );
          })}
        </div>

        {topRow.length ? (
          <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
            {topRow.map((sw) => (
              <Footswitch
                key={sw.index}
                index={sw.index}
                label={scribbleLabel(preset, fsMode, sw.index, xl)}
                color={scribbleColor(preset, fsMode, sw.index, activeSnapshot)}
                lit={isLit(preset, fsMode, sw.index, activeSnapshot)}
                onClick={() => pressFs(sw.index)}
              />
            ))}
          </div>
        ) : null}

        <div className={cn("mt-3 grid gap-2 sm:gap-3", xl ? "grid-cols-4" : "grid-cols-3")}>
          {bottomRow.map((sw) => (
            <Footswitch
              key={sw.index}
              index={sw.index}
              label={scribbleLabel(preset, fsMode, sw.index, xl)}
              color={scribbleColor(preset, fsMode, sw.index, activeSnapshot)}
              lit={isLit(preset, fsMode, sw.index, activeSnapshot)}
              onClick={() => pressFs(sw.index)}
            />
          ))}
        </div>

        <p className="mt-4 px-1 text-center font-mono text-[9px] leading-relaxed tracking-wide text-zinc-500">
          {xl ? "Volume is on the rear panel. " : ""}
          PAGE cycles Stomp / Snapshot / Preset in Play, parameters in Edit. Home toggles Play/Edit.
          Action opens tuner (Play) or bypasses the block (Edit). Home then Action saves.
        </p>
      </div>
    </div>
  );
}

function scribbleLabel(preset: Preset, fsMode: FsMode, index: number, xl: boolean): string {
  if (fsMode === "snapshot") return preset.snapshots[index - 1]?.name.slice(0, 8).toUpperCase() ?? "—";
  if (fsMode === "preset") {
    if (xl) {
      return ["PRESET-", "PRESET+", "TAP", "TUNER", "BANK-", "BANK+", "MODE", "MENU"][index - 1] ?? "";
    }
    return ["PRESET-", "TAP", "PRESET+"][index - 1] ?? "";
  }
  return preset.footswitches.find((f) => f.index === index)?.label ?? `FS${index}`;
}

function scribbleColor(preset: Preset, fsMode: FsMode, index: number, activeSnapshot: number): string {
  if (fsMode === "snapshot") return preset.snapshots[index - 1]?.color ?? "#3a3d42";
  if (fsMode === "preset") return index === (preset.stompModel === "hx-stomp-xl" ? 4 : 2) ? "#7dff9a" : "#5a5e62";
  return preset.footswitches.find((f) => f.index === index)?.color ?? "#4a4e54";
}

function isLit(preset: Preset, fsMode: FsMode, index: number, activeSnapshot: number): boolean {
  if (fsMode === "snapshot") return activeSnapshot === index - 1;
  if (fsMode === "preset") return false;
  const assign = preset.footswitches.find((f) => f.index === index);
  if (!assign) return false;
  if (assign.action === "bypass" && assign.targetBlockId) {
    return preset.blocks.find((b) => b.id === assign.targetBlockId)?.enabled !== false;
  }
  if (assign.action === "snapshot") {
    return preset.snapshots.findIndex((s) => s.id === assign.snapshotId) === activeSnapshot;
  }
  return true;
}

function HwBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hx-hw-btn">
      {children}
    </button>
  );
}

function Footswitch({
  index,
  label,
  color,
  lit,
  onClick,
}: {
  index: number;
  label: string;
  color: string;
  lit: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-11 flex-col items-center gap-1.5">
      <span
        className="hx-fs relative grid size-14 place-items-center rounded-full sm:size-16"
        style={{
          boxShadow: lit
            ? `0 0 0 2px #0a0b0d, 0 0 0 4px ${color}, 0 0 14px ${color}`
            : `0 0 0 2px #0a0b0d, 0 0 0 4px ${color}55`,
        }}
      >
        <span className="font-mono text-[9px] text-zinc-500">{index}</span>
      </span>
      <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-zinc-400">
        {label}
      </span>
    </button>
  );
}
