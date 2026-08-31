import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Preset } from "@/data/types";
import { deviceFor, paramEntries, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
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
  const showFsNumbers = useAppStore((s) => s.showFsNumbers);
  const largeControls = useAppStore((s) => s.largeControls);

  const switches = useMemo(() => {
    const n = xl ? 6 : 3;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [xl]);

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
    onAssignFsIndex(index);
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
      const assign = preset.footswitches.find((f) => f.index === index);
      if (assign?.action === "snapshot" && assign.snapshotId) {
        const idx = preset.snapshots.findIndex((s) => s.id === assign.snapshotId);
        if (idx >= 0) onSnapshot(idx);
      }
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
      onSnapshot(idx >= 0 ? idx : 0);
      return;
    }
    if (assign.action === "bypass" && assign.targetBlockId) {
      onToggleBlock(assign.targetBlockId);
    }
  }

  const knobs = (
    <div className="flex items-end justify-center gap-3 sm:gap-4">
      {([0, 1, 2] as const).map((i) => {
        const p = pageParams[i];
        return (
          <Knob
            key={p?.name ?? `empty-${i}`}
            label={p?.name ?? "—"}
            value={p?.value ?? 0}
            size={largeControls ? "lg" : "md"}
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
      <span className="hx-silk hx-well-save">Save</span>
      <HwBtn onClick={() => onPage(-1)}>{"◀"}</HwBtn>
      <Knob
        label=""
        value={preset.snapshots.length ? ((activeSnapshot + 1) / preset.snapshots.length) * 10 : 0}
        size="sm"
        showValue={false}
        onPress={() => {
          if (preset.snapshots.length) onSnapshot((activeSnapshot + 1) % preset.snapshots.length);
        }}
      />
      <HwBtn onClick={() => onPage(1)}>{"▶"}</HwBtn>
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
      view={view === "assign" ? "play" : view}
      fsMode={fsMode}
      paramPage={page}
      activeSnapshot={activeSnapshot}
      assignFsIndex={assignFsIndex}
      showDsp={showDsp}
      onScribbleTap={onAssignFsIndex}
    />
  );

  function renderSwitch(index: number) {
    const numbered = index <= 6 && showFsNumbers;
    return (
      <Footswitch
        key={index}
        index={index}
        label={scribbleLabel(preset, fsMode, index, xl)}
        sublabel={index === 7 ? "Edit / Exit" : index === 8 ? "Tuner" : undefined}
        color={scribbleColor(preset, fsMode, index, activeSnapshot, xl)}
        lit={isLit(preset, fsMode, index, activeSnapshot, xl, view)}
        selected={assignFsIndex === index}
        showNumber={numbered}
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
            <div className="hx-xl-fs1">{renderSwitch(1)}</div>
            <div className="hx-xl-fs2">{renderSwitch(2)}</div>
            <div className="hx-xl-fs3">{renderSwitch(3)}</div>
            <div className="hx-xl-lcd">
              {lcd}
              {knobs}
            </div>
            <div className="hx-xl-well">{well}</div>
            <div className="hx-xl-fs4">{renderSwitch(4)}</div>
            <div className="hx-xl-fs5">{renderSwitch(5)}</div>
            <div className="hx-xl-fs6">{renderSwitch(6)}</div>
            <div className="hx-xl-mode">{renderSwitch(7)}</div>
            <div className="hx-xl-tap">{renderSwitch(8)}</div>
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
              {switches.map((index) => renderSwitch(index))}
            </div>
          </div>
        )}
        {xl ? <p className="hx-silk mt-3 text-center">Vol on rear</p> : null}
      </div>
    </div>
  );
}

function assigned(preset: Preset, index: number) {
  return preset.footswitches.find((f) => f.index === index);
}

function scribbleLabel(preset: Preset, fsMode: FsMode, index: number, xl: boolean): string {
  if (xl && index === 7) return "MODE";
  if (xl && index === 8) return "TAP";
  if (fsMode === "preset") {
    if (xl) return { 1: "▲", 2: "C", 3: "D", 4: "▼", 5: "A", 6: "B" }[index] ?? "";
    return ["PRESET-", "TAP", "PRESET+"][index - 1] ?? "";
  }
  const a = assigned(preset, index);
  if (a?.label) return a.label;
  return "";
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
  const a = assigned(preset, index);
  if (a?.color) return a.color;
  return "#4a4e54";
}

function isLit(
  preset: Preset,
  fsMode: FsMode,
  index: number,
  activeSnapshot: number,
  xl: boolean,
  view: LcdView,
): boolean {
  if (view === "tuner") return xl && index === 8;
  if (xl && index === 7) return fsMode !== "stomp";
  if (xl && index === 8) return false;
  const a = assigned(preset, index);
  if (fsMode === "snapshot") {
    if (a?.action === "snapshot" && a.snapshotId) {
      return preset.snapshots.findIndex((s) => s.id === a.snapshotId) === activeSnapshot;
    }
    return false;
  }
  if (fsMode === "preset") return false;
  if (!a) return false;
  if (a.action === "bypass" && a.targetBlockId) {
    return preset.blocks.find((b) => b.id === a.targetBlockId)?.enabled !== false;
  }
  if (a.action === "snapshot") {
    return preset.snapshots.findIndex((s) => s.id === a.snapshotId) === activeSnapshot;
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
  sublabel,
  color,
  lit,
  selected,
  showNumber,
  onClick,
}: {
  index: number;
  label: string;
  sublabel?: string;
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
      aria-label={label ? `Switch ${index} ${label}` : `Switch ${index}`}
      aria-pressed={selected}
      className="group flex min-h-11 flex-col items-center gap-1"
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
        {showNumber ? <span className="font-mono text-[10px] font-semibold text-zinc-300">{index}</span> : null}
      </span>
      <span className="max-w-[4.5rem] truncate font-mono text-[9px] uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      {sublabel ? <span className="hx-silk">{sublabel}</span> : null}
    </button>
  );
}
