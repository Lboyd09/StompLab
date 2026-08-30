import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Preset } from "@/data/types";
import { deviceFor, footswitchPlace, paramEntries, sortedBlocks } from "@/lib/preset-utils";
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
  showFsNumbers?: boolean;
  onParamPage: (page: number) => void;
  onView: (view: LcdView) => void;
  onFsMode: (mode: FsMode) => void;
  onSnapshot: (index: number) => void;
  onChangeParam: (blockId: string, name: string, value: number) => void;
  onToggleBlock: (blockId: string) => void;
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
  showFsNumbers = false,
  onParamPage,
  onView,
  onFsMode,
  onSnapshot,
  onChangeParam,
  onToggleBlock,
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
      toast.success("Saved. On a real Stomp, View + Action writes the preset.");
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
    if (xl && index === 7) {
      cycleMode(1);
      return;
    }
    if (xl && index === 8) {
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
    <div className="flex items-end justify-center gap-6 sm:gap-8">
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

  const well = (
    <div className="hx-well" aria-label="View, knobs, Action, Page">
      <HwBtn onClick={onHome}>View</HwBtn>
      <Knob
        label=""
        value={blocks.length ? ((blocks.findIndex((b) => b.id === selected?.id) + 1) / blocks.length) * 10 : 0}
        size="sm"
        showValue={false}
        onPress={() => cycleBlock(1)}
      />
      <HwBtn onClick={onAction}>Action</HwBtn>
      <HwBtn onClick={() => onPage(-1)}>{"<"}</HwBtn>
      <Knob
        label=""
        value={preset.snapshots.length ? ((activeSnapshot + 1) / preset.snapshots.length) * 10 : 0}
        size="sm"
        showValue={false}
        onPress={() => {
          if (preset.snapshots.length) onSnapshot((activeSnapshot + 1) % preset.snapshots.length);
        }}
      />
      <HwBtn onClick={() => onPage(1)}>{">"}</HwBtn>
      <span className="hx-silk col-span-3 -mt-1">Page</span>
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
    />
  );

  function renderSwitch(index: number) {
    return (
      <Footswitch
        key={index}
        index={index}
        place={footswitchPlace(index, xl)}
        label={scribbleLabel(preset, fsMode, index, xl, view === "assign")}
        color={scribbleColor(preset, fsMode, index, activeSnapshot, xl)}
        lit={isLit(preset, fsMode, index, activeSnapshot, xl, view)}
        selected={view === "assign" && assignFsIndex === index}
        showNumber={showFsNumbers}
        onClick={() => pressFs(index)}
      />
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className={cn("hx-chassis mx-auto w-full", xl ? "hx-chassis-xl" : "hx-chassis-stomp")}>
        <div className="hx-brand">
          <span className="hx-brand-mark">Line 6</span>
          <span className="hx-brand-mark">{xl ? "HX Stomp XL" : "HX Stomp"}</span>
        </div>

        {xl ? (
          <div className="hx-xl-board">
            <div className="hx-xl-fs">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[4, 5, 6].map(renderSwitch)}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[1, 2, 3].map(renderSwitch)}
              </div>
              <p className="hx-silk text-center">Closest row is 1 · 2 · 3</p>
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">{lcd}</div>
                {well}
              </div>
              {knobs}
            </div>
            <div className="hx-xl-mode">
              {renderSwitch(7)}
              {renderSwitch(8)}
              <p className="hx-silk text-center">Vol on rear</p>
            </div>
          </div>
        ) : (
          <div className="hx-stomp-board">
            <div className="hx-stomp-lcd">{lcd}</div>
            <div className="hx-stomp-well">{well}</div>
            <div className="hx-stomp-vol">
              <Knob label="Volume" value={volume} onChange={setVolume} size="md" />
            </div>
            <div className="hx-stomp-knobs">{knobs}</div>
            <div className="hx-stomp-fs grid grid-cols-3 gap-3 sm:gap-5">
              {switches.map((sw) => renderSwitch(sw.index))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function scribbleLabel(preset: Preset, fsMode: FsMode, index: number, xl: boolean, assigning: boolean): string {
  if (assigning) return preset.footswitches.find((f) => f.index === index)?.label ?? "empty";
  if (xl && index === 7) return "MODE";
  if (xl && index === 8) return "TAP";
  if (fsMode === "snapshot") return preset.snapshots[index - 1]?.name.slice(0, 8).toUpperCase() ?? "—";
  if (fsMode === "preset") {
    if (xl) {
      return { 1: "BANK-", 2: "A", 3: "B", 4: "BANK+", 5: "PRESET-", 6: "PRESET+" }[index] ?? "";
    }
    return ["PRESET-", "TAP", "PRESET+"][index - 1] ?? "";
  }
  return preset.footswitches.find((f) => f.index === index)?.label ?? "empty";
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
  place,
  label,
  color,
  lit,
  selected,
  showNumber,
  onClick,
}: {
  index: number;
  place: string;
  label: string;
  color: string;
  lit: boolean;
  selected?: boolean;
  showNumber: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${place}${label ? ` · ${label}` : ""}`}
      className="group flex min-h-11 flex-col items-center gap-1.5"
    >
      <span
        className="hx-fs hx-fs-cap relative grid place-items-center rounded-full"
        style={{
          boxShadow: lit
            ? `0 0 0 2px #0a0b0d, 0 0 0 5px ${color}, 0 0 16px ${color}`
            : selected
              ? `0 0 0 2px #0a0b0d, 0 0 0 5px #e8e6df`
              : `0 0 0 2px #0a0b0d, 0 0 0 4px ${color}66`,
        }}
      >
        {showNumber ? <span className="font-mono text-[9px] text-zinc-500">{index}</span> : null}
      </span>
      <span className="max-w-[4.5rem] truncate font-mono text-[9px] uppercase tracking-wider text-zinc-400">
        {label}
      </span>
    </button>
  );
}
