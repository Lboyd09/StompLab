import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { FootswitchAssign, Preset } from "@/data/types";
import { deviceFor, paramEntries, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { Knob } from "./knob";
import { LcdScreen } from "./lcd";

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
  onParamPage: (page: number) => void;
  onView: (view: LcdView) => void;
  onFsMode: (mode: FsMode) => void;
  onSnapshot: (index: number) => void;
  onChangeParam: (blockId: string, name: string, value: number) => void;
  onToggleBlock: (blockId: string) => void;
  onAssignFs: (index: number, patch: Partial<FootswitchAssign>) => void;
  onAssignFsIndex: (index: number) => void;
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
  assignFsIndex,
  showDsp = true,
  onParamPage,
  onView,
  onFsMode,
  onSnapshot,
  onChangeParam,
  onToggleBlock,
  onAssignFs,
  onAssignFsIndex,
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
    if (view === "tuner" || view === "assign" || view === "edit") {
      onView("play");
      if (view === "edit") onSelectBlock(null);
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
    if (view === "assign") {
      onView("play");
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
    if (view === "assign") {
      onAssignFsIndex(index);
      return;
    }
    if (view === "tuner") {
      onView("play");
      return;
    }
    if (xl && fsMode !== "stomp" && index === 7) {
      cycleMode(1);
      return;
    }
    if (xl && fsMode !== "stomp" && index === 8) {
      onView("tuner");
      return;
    }
    if (fsMode === "snapshot") {
      const snap = preset.snapshots[index - 1];
      if (snap) onSnapshot(index - 1);
      return;
    }
    if (fsMode === "preset") {
      if (index === 2 && !xl) onView("tuner");
      return;
    }
    const assign = preset.footswitches.find((f) => f.index === index);
    if (!assign) return;
    if (assign.action === "tuner") {
      onView("tuner");
      return;
    }
    if (assign.action === "mode") {
      cycleMode(1);
      return;
    }
    if (assign.action === "tap") {
      toast.success(`Tap tempo · ${preset.tempo} BPM`);
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

  const knobs = (
    <div className="flex items-end justify-center gap-5 sm:gap-7">
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
  );

  const consoleBtns = (
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
        value={preset.snapshots.length ? ((activeSnapshot + 1) / preset.snapshots.length) * 10 : 0}
        size="sm"
        onPress={() => {
          if (preset.snapshots.length) onSnapshot((activeSnapshot + 1) % preset.snapshots.length);
        }}
      />
      <div className="mt-0.5 flex gap-0.5">
        <HwBtn onClick={() => onPage(-1)}>{"<"}</HwBtn>
        <HwBtn onClick={() => onPage(1)}>{">"}</HwBtn>
      </div>
      <span className="hx-silk">Page</span>
    </div>
  );

  const lcd = (
    <LcdScreen
      preset={preset}
      selectedBlockId={selectedBlockId}
      onSelectBlock={(id) => {
        onSelectBlock(id);
        if (view !== "assign") onView("edit");
      }}
      view={view}
      fsMode={fsMode}
      paramPage={page}
      activeSnapshot={activeSnapshot}
      assignFsIndex={assignFsIndex}
      showDsp={showDsp}
      onScribbleTap={(index) => {
        onAssignFsIndex(index);
        if (view !== "assign") onView("assign");
      }}
      onAssign={onAssignFs}
    />
  );

  function renderSwitch(index: number) {
    return (
      <Footswitch
        key={index}
        index={index}
        label={scribbleLabel(preset, fsMode, index, xl, view === "assign")}
        color={scribbleColor(preset, fsMode, index, activeSnapshot, xl)}
        lit={isLit(preset, fsMode, index, activeSnapshot, xl, view)}
        selected={view === "assign" && assignFsIndex === index}
        onClick={() => pressFs(index)}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className={cn("hx-chassis mx-auto w-full", xl ? "hx-chassis-xl" : "hx-chassis-stomp")}>
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="hx-silk">Line 6</span>
          <span className="hx-silk">{device.name}</span>
        </div>

        {xl ? (
          <div className="hx-xl-board">
            <div className="flex flex-col justify-end gap-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">{[4, 5, 6].map(renderSwitch)}</div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">{[1, 2, 3].map(renderSwitch)}</div>
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">{lcd}</div>
                {consoleBtns}
              </div>
              {knobs}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:self-end">
              {renderSwitch(7)}
              {renderSwitch(8)}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-stretch gap-2 sm:gap-3">
              <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1">
                <Knob label="Volume" value={volume} onChange={setVolume} size="md" />
              </div>
              <div className="min-w-0 flex-1">{lcd}</div>
              {consoleBtns}
            </div>
            <div className="mt-4">{knobs}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">{switches.map((sw) => renderSwitch(sw.index))}</div>
          </>
        )}

        <p className="mt-4 px-1 text-center font-mono text-[9px] leading-relaxed tracking-wide text-zinc-500">
          {xl
            ? "Wide board: FS1–FS6 on the left, LCD in the middle, MODE and TAP on the right. Volume is on the rear. "
            : ""}
          PAGE cycles Stomp / Snapshot / Preset in Play. Home toggles Play/Edit. Action opens tuner. Tap a scribble strip to assign a switch.
        </p>
      </div>
    </div>
  );
}

function scribbleLabel(preset: Preset, fsMode: FsMode, index: number, xl: boolean, assigning: boolean): string {
  if (assigning) return preset.footswitches.find((f) => f.index === index)?.label ?? `FS${index}`;
  if (xl && index === 7) return "MODE";
  if (xl && index === 8) return "TAP";
  if (fsMode === "snapshot") return preset.snapshots[index - 1]?.name.slice(0, 8).toUpperCase() ?? "—";
  if (fsMode === "preset") {
    if (xl) {
      return { 1: "BANK-", 2: "A", 3: "B", 4: "BANK+", 5: "PRESET-", 6: "PRESET+" }[index] ?? `FS${index}`;
    }
    return ["PRESET-", "TAP", "PRESET+"][index - 1] ?? "";
  }
  return preset.footswitches.find((f) => f.index === index)?.label ?? `FS${index}`;
}

function scribbleColor(
  preset: Preset,
  fsMode: FsMode,
  index: number,
  activeSnapshot: number,
  xl: boolean,
): string {
  if (xl && index === 7) return "#5a5e62";
  if (xl && index === 8) return "#e24a3a";
  if (fsMode === "snapshot") return preset.snapshots[index - 1]?.color ?? "#3a3d42";
  if (fsMode === "preset") return index === 2 && !xl ? "#7dff9a" : "#5a5e62";
  return preset.footswitches.find((f) => f.index === index)?.color ?? "#4a4e54";
}

function isLit(
  preset: Preset,
  fsMode: FsMode,
  index: number,
  activeSnapshot: number,
  xl: boolean,
  view: LcdView,
): boolean {
  if (view === "assign") return false;
  if (xl && index === 7) return fsMode !== "stomp";
  if (xl && index === 8) return view === "tuner";
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
  selected,
  onClick,
}: {
  index: number;
  label: string;
  color: string;
  lit: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-11 flex-col items-center gap-1.5">
      <span
        className="hx-fs hx-fs-cap relative grid place-items-center rounded-full"
        style={{
          boxShadow: lit
            ? `0 0 0 2px #0a0b0d, 0 0 0 4px ${color}, 0 0 14px ${color}`
            : selected
              ? `0 0 0 2px #0a0b0d, 0 0 0 4px #e8e6df`
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
