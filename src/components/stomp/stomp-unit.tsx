import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { DeviceLayout, Preset } from "@/data/types";
import { deviceFor, paramEntries, sortedBlocks, visualToHardwareFs } from "@/lib/preset-utils";
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

const BRAND: Record<DeviceLayout, { left: string; right: string }> = {
  stomp: { left: "Line 6", right: "HX Stomp" },
  xl: { left: "Line 6", right: "HX Stomp XL" },
  floor: { left: "Line 6", right: "Helix" },
  lt: { left: "Line 6", right: "Helix LT" },
  effects: { left: "Line 6", right: "HX Effects" },
  podgo: { left: "Line 6", right: "POD Go" },
};

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
  const layout = device.layout;
  const xl = layout === "xl";
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
    const n = layout === "stomp" ? 3 : xl ? 6 : device.footswitches;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [layout, xl, device.footswitches]);

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
      toast.success("Saved. On a real unit, View + Action writes the preset.");
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
      } else if (preset.snapshots[index - 1]) {
        onSnapshot(index - 1);
      }
      return;
    }
    if (fsMode === "preset") {
      if (index === 2 && layout === "stomp") onView("tuner");
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
    <div className="hx-knob-row">
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

  function paramKnobs(count: number, size: "sm" | "md") {
    return (
      <div className="hx-knob-row">
        {Array.from({ length: count }, (_, i) => {
          const p = params[i];
          return (
            <Knob
              key={p?.name ?? `slot-${i}`}
              label={p?.name ?? "—"}
              value={p?.value ?? 0}
              size={size}
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
  }

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

  function renderSwitch(index: number, opts?: { hideLabel?: boolean }) {
    const numbered = index <= device.footswitches && showFsNumbers && !(xl && index > 6);
    return (
      <Footswitch
        key={index}
        index={index}
        number={visualToHardwareFs(index, xl)}
        label={opts?.hideLabel ? "" : scribbleLabel(preset, fsMode, index, layout)}
        sublabel={
          xl && index === 7
            ? "Edit / Exit"
            : xl && index === 8
              ? "Tuner"
              : layout === "podgo" && index === 8
                ? "Tuner"
                : undefined
        }
        color={scribbleColor(preset, fsMode, index, activeSnapshot, layout)}
        lit={isLit(preset, fsMode, index, activeSnapshot, layout, view)}
        selected={assignFsIndex === index}
        showNumber={numbered}
        onClick={() => pressFs(index)}
      />
    );
  }

  const brand = BRAND[layout];
  const chassisClass =
    layout === "xl"
      ? "hx-chassis-xl"
      : layout === "floor"
        ? "hx-chassis-floor"
        : layout === "lt"
          ? "hx-chassis-lt"
          : layout === "effects"
            ? "hx-chassis-effects"
            : layout === "podgo"
              ? "hx-chassis-podgo"
              : "hx-chassis-stomp";

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className={cn("hx-chassis mx-auto w-full", chassisClass)}>
        <div className="hx-brand">
          <span className="hx-brand-mark">{brand.left}</span>
          <span className="hx-brand-mark">{brand.right}</span>
        </div>

        {layout === "xl" ? (
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
        ) : layout === "floor" || layout === "lt" ? (
          <HelixBoard
            layout={layout}
            lcd={lcd}
            knobs={paramKnobs(6, "sm")}
            well={well}
            volume={volume}
            onVolume={setVolume}
            onMode={() => cycleMode(1)}
            onTap={() => onView(view === "tuner" ? "play" : "tuner")}
            fsMode={fsMode}
            tuner={view === "tuner"}
            renderFs={(index) =>
              renderSwitch(index, { hideLabel: layout === "floor" })
            }
            scribble={(index) =>
              layout === "floor" ? (
                <ScribbleStrip
                  label={scribbleLabel(preset, fsMode, index, layout)}
                  color={scribbleColor(preset, fsMode, index, activeSnapshot, layout)}
                  active={assignFsIndex === index}
                  onClick={() => pressFs(index)}
                />
              ) : null
            }
          />
        ) : layout === "effects" ? (
          <EffectsBoard
            lcd={lcd}
            knobs={knobs}
            well={well}
            renderFs={(index) => renderSwitch(index, { hideLabel: true })}
            scribble={(index) => (
              <ScribbleStrip
                label={scribbleLabel(preset, fsMode, index, layout)}
                color={scribbleColor(preset, fsMode, index, activeSnapshot, layout)}
                active={assignFsIndex === index}
                onClick={() => pressFs(index)}
              />
            )}
          />
        ) : layout === "podgo" ? (
          <PodGoBoard
            lcd={lcd}
            knobs={paramKnobs(5, "sm")}
            well={well}
            renderFs={(index) => renderSwitch(index)}
          />
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
        {xl ? (
          <p className="hx-silk mt-3 text-center">
            You stand here · closest row is 1–3 · far row is 4–6 · MODE / TAP on the right
          </p>
        ) : layout === "podgo" ? (
          <p className="hx-silk mt-3 text-center">Closest row 1–4 · far row 5–8 · FS8 is TAP / Tuner · EXP on the left</p>
        ) : layout === "effects" ? (
          <p className="hx-silk mt-3 text-center">Closest row 1–4 · far row 5–8 · scribble strips match HX Effects</p>
        ) : layout === "floor" || layout === "lt" ? (
          <p className="hx-silk mt-3 text-center">
            You stand here · closest row 1–6 · far row 7–12 · MODE / TAP on the left
          </p>
        ) : (
          <p className="hx-silk mt-3 text-center">Switches 1–3 left to right · Volume on the right · you stand here</p>
        )}
      </div>
    </div>
  );
}

function HelixBoard({
  layout,
  lcd,
  knobs,
  well,
  volume,
  onVolume,
  onMode,
  onTap,
  fsMode,
  tuner,
  renderFs,
  scribble,
}: {
  layout: "floor" | "lt";
  lcd: ReactNode;
  knobs: ReactNode;
  well: ReactNode;
  volume: number;
  onVolume: (n: number) => void;
  onMode: () => void;
  onTap: () => void;
  fsMode: FsMode;
  tuner: boolean;
  renderFs: (index: number) => ReactNode;
  scribble: (index: number) => ReactNode;
}) {
  const top = [7, 8, 9, 10, 11, 12];
  const bottom = [1, 2, 3, 4, 5, 6];
  return (
    <div className={cn("hx-helix-board", layout === "lt" && "hx-helix-board-lt")}>
      <div className="hx-helix-top">
        <div className="hx-helix-lcd">{lcd}</div>
        <div className="hx-helix-controls">
          {knobs}
          <div className="flex items-center justify-center gap-3">
            <button type="button" className="hx-joystick" aria-label="Joystick" />
            <Knob label="Vol" value={volume} onChange={onVolume} size="sm" />
          </div>
          <div className="flex justify-center">{well}</div>
        </div>
        <div className="hx-helix-pedals">
          {layout === "floor" ? <ExpPedal label="EXP 2" tall /> : null}
          <ExpPedal label="EXP 1" />
        </div>
      </div>
      <div className="hx-helix-fs">
        <div className="hx-helix-modetap">
          <Footswitch
            index={0}
            label="MODE"
            color="#5a5e62"
            lit={fsMode !== "stomp"}
            showNumber={false}
            onClick={onMode}
          />
          <Footswitch
            index={0}
            label="TAP"
            sublabel="Tuner"
            color="#e24a3a"
            lit={tuner}
            showNumber={false}
            onClick={onTap}
          />
        </div>
        <div className="hx-helix-grid">
          <div className="hx-helix-row">
            {top.map((index) => (
              <div key={`t-${index}`} className="hx-helix-cell">
                {scribble(index)}
                {renderFs(index)}
              </div>
            ))}
          </div>
          <div className="hx-helix-row">
            {bottom.map((index) => (
              <div key={`b-${index}`} className="hx-helix-cell">
                {scribble(index)}
                {renderFs(index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EffectsBoard({
  lcd,
  knobs,
  well,
  renderFs,
  scribble,
}: {
  lcd: ReactNode;
  knobs: ReactNode;
  well: ReactNode;
  renderFs: (index: number) => ReactNode;
  scribble: (index: number) => ReactNode;
}) {
  const top = [5, 6, 7, 8];
  const bottom = [1, 2, 3, 4];
  return (
    <div className="hx-effects-board">
      <div className="hx-effects-top">
        <div className="hx-effects-lcd">{lcd}</div>
        <div className="flex flex-col items-center gap-3">
          {knobs}
          {well}
        </div>
      </div>
      <div className="hx-effects-grid">
        <div className="hx-helix-row">
          {top.map((index) => (
            <div key={`e-t-${index}`} className="hx-helix-cell">
              {scribble(index)}
              {renderFs(index)}
            </div>
          ))}
        </div>
        <div className="hx-helix-row">
          {bottom.map((index) => (
            <div key={`e-b-${index}`} className="hx-helix-cell">
              {scribble(index)}
              {renderFs(index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PodGoBoard({
  lcd,
  knobs,
  well,
  renderFs,
}: {
  lcd: ReactNode;
  knobs: ReactNode;
  well: ReactNode;
  renderFs: (index: number) => ReactNode;
}) {
  return (
    <div className="hx-podgo-board">
      <div className="hx-podgo-exp">
        <ExpPedal label="EXP" tall />
      </div>
      <div className="hx-podgo-main">
        <div className="hx-podgo-lcd">{lcd}</div>
        <div className="flex flex-wrap items-start justify-center gap-3">
          {knobs}
          {well}
        </div>
        <div className="hx-podgo-fs">
          {[5, 6, 7, 8].map((index) => renderFs(index))}
          {[1, 2, 3, 4].map((index) => renderFs(index))}
        </div>
      </div>
    </div>
  );
}

function ExpPedal({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div className="hx-exp" aria-hidden>
      <span className={cn("hx-exp-tread", tall && "hx-exp-tall")} />
      <span className="hx-silk">{label}</span>
    </div>
  );
}

function ScribbleStrip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("hx-scribble", active && "hx-scribble-on")}
      onClick={onClick}
      style={{ boxShadow: `inset 0 -2px 0 ${color}` }}
    >
      {label || "—"}
    </button>
  );
}

function assigned(preset: Preset, index: number) {
  return preset.footswitches.find((f) => f.index === index);
}

function scribbleLabel(preset: Preset, fsMode: FsMode, index: number, layout: DeviceLayout): string {
  if (layout === "xl" && index === 7) return "MODE";
  if (layout === "xl" && index === 8) return "TAP";
  if (fsMode === "preset") {
    if (layout === "xl") return { 1: "▲", 2: "C", 3: "D", 4: "▼", 5: "A", 6: "B" }[index] ?? "";
    if (layout === "floor" || layout === "lt") {
      return ["A", "B", "C", "D", "E", "F", "▲", "1", "2", "3", "4", "▼"][index - 1] ?? "";
    }
    if (layout === "stomp") return ["PRESET-", "TAP", "PRESET+"][index - 1] ?? "";
    return ["A", "B", "C", "D", "E", "F", "G", "TAP"][index - 1] ?? "";
  }
  const a = assigned(preset, index);
  if (a?.label) return a.label;
  if (preset.snapshots[index - 1]) return preset.snapshots[index - 1].name.slice(0, 8).toUpperCase();
  return "";
}

function scribbleColor(
  preset: Preset,
  _fsMode: FsMode,
  index: number,
  _activeSnapshot: number,
  layout: DeviceLayout,
): string {
  if (layout === "xl" && index === 7) return "#5a5e62";
  if (layout === "xl" && index === 8) return "#e24a3a";
  const a = assigned(preset, index);
  if (a?.color) return a.color;
  const snap = preset.snapshots[index - 1];
  if (snap?.color) return snap.color;
  return "#4a4e54";
}

function isLit(
  preset: Preset,
  fsMode: FsMode,
  index: number,
  activeSnapshot: number,
  layout: DeviceLayout,
  view: LcdView,
): boolean {
  if (view === "tuner") return layout === "xl" && index === 8;
  if (layout === "xl" && index === 7) return fsMode !== "stomp";
  if (layout === "xl" && index === 8) return false;
  const a = assigned(preset, index);
  if (fsMode === "snapshot") {
    if (a?.action === "snapshot" && a.snapshotId) {
      return preset.snapshots.findIndex((s) => s.id === a.snapshotId) === activeSnapshot;
    }
    return preset.snapshots[index - 1] ? index - 1 === activeSnapshot : false;
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
  number,
  label,
  sublabel,
  color,
  lit,
  selected,
  showNumber,
  onClick,
}: {
  index: number;
  number?: number;
  label: string;
  sublabel?: string;
  color: string;
  lit: boolean;
  selected?: boolean;
  showNumber: boolean;
  onClick: () => void;
}) {
  const shown = number ?? index;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `Switch ${shown || label} ${label}` : `Switch ${shown}`}
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
        {showNumber ? <span className="font-mono text-[10px] font-semibold text-zinc-300">{shown}</span> : null}
      </span>
      {label ? (
        <span className="max-w-[4.5rem] truncate font-mono text-[9px] uppercase tracking-wider text-zinc-400">
          {label}
        </span>
      ) : null}
      {sublabel ? <span className="hx-silk">{sublabel}</span> : null}
    </button>
  );
}
