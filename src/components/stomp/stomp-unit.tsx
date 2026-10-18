import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CATEGORY_MAP } from "@/data/categories";
import type { Preset } from "@/data/types";
import { blockModel, deviceFor, paramEntries, sortedBlocks, type ParamEntry } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { fitSwitchLabel, pedalTargets, switchFaces, unitSpec, type FsMode, type LcdView, type SwitchFace, type UnitSpec } from "./hardware";
import { Knob } from "./knob";
import { LcdScreen } from "./lcd";

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
  /** Optional: called with the tempo the player tapped on TAP (two or more taps). */
  onTapTempo?: (bpm: number) => void;
};

const BRAND: Record<string, string> = {
  stomp: "HX Stomp",
  xl: "HX Stomp XL",
  floor: "Helix",
  lt: "Helix LT",
  effects: "HX Effects",
  podgo: "POD Go",
};

const MODE_CYCLE: FsMode[] = ["stomp", "preset", "snapshot"];

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
  onTapTempo,
}: Props) {
  const device = deviceFor(preset);
  const layout = device.layout;
  const spec = unitSpec(layout);
  const helix = layout === "floor" || layout === "lt";
  const blocks = sortedBlocks(preset);
  const selected = blocks.find((b) => b.id === selectedBlockId) ?? blocks[0];
  const params = selected ? paramEntries(selected) : [];
  const perPage = spec.knobs;
  const pageCount = Math.max(1, Math.ceil(params.length / perPage));
  const page = ((paramPage % pageCount) + pageCount) % pageCount;
  const pageParams = params.slice(page * perPage, page * perPage + perPage);
  const faces = switchFaces(preset, layout, fsMode, activeSnapshot);
  const lcdView: "play" | "edit" | "tuner" = view === "assign" ? "play" : view;
  const largeControls = useAppStore((s) => s.largeControls);
  const showFsNumbers = useAppStore((s) => s.showFsNumbers);

  const [volume, setVolume] = useState(7);
  const [phones, setPhones] = useState(6);
  const [tapped, setTapped] = useState<number | null>(null);
  const taps = useRef<number[]>([]);
  const downs = useRef<Record<number, number>>({});
  const combo = useRef(0);
  const lastView = useRef(0);

  // A new preset or unit forgets the tapped tempo.
  useEffect(() => setTapped(null), [preset.id]);
  const tempo = tapped ?? preset.tempo;

  /** The workspace's toggle switches to Snapshot mode; a stomp press must leave the unit in Stomp mode. */
  function toggle(blockId: string) {
    const keep = fsMode;
    onToggleBlock(blockId);
    if (keep !== "snapshot") onFsMode(keep);
  }

  function selectBlock(id: string | null, toEdit = true) {
    onSelectBlock(id);
    if (toEdit && !(layout === "lt" && view === "play")) onView("edit");
  }

  function stepBlock(dir: 1 | -1) {
    if (!blocks.length) return;
    const i = Math.max(0, blocks.findIndex((b) => b.id === selected?.id));
    selectBlock(blocks[(i + dir + blocks.length) % blocks.length].id);
  }

  function tap() {
    const now = Date.now();
    const recent = taps.current.filter((t) => now - t < 2500);
    recent.push(now);
    taps.current = recent.slice(-4);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const bpm = Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
      if (bpm >= 40 && bpm <= 240) {
        setTapped(bpm);
        onTapTempo?.(bpm);
      }
    }
  }

  function tuner() {
    onView(view === "tuner" ? "play" : "tuner");
  }

  function pressFace(face: SwitchFace) {
    if (view === "tuner") {
      onView("play");
      return;
    }
    // The assign panel edits the stomp at this switch number, so only stomp positions select it.
    if (fsMode === "stomp" && spec.stompFs.includes(face.index)) onAssignFsIndex(face.index);
    switch (face.kind) {
      case "snapshot":
        if (face.snapshotIndex !== undefined) onSnapshot(face.snapshotIndex);
        return;
      case "stomp":
        if (face.blockId) toggle(face.blockId);
        return;
      case "tap":
        tap();
        return;
      case "mode":
        onFsMode(fsMode === "snapshot" ? "stomp" : fsMode === "stomp" ? "preset" : "stomp");
        return;
      case "up":
      case "down": {
        const other = face.kind === "up" ? spec.down : spec.up;
        const t = other ? downs.current[other] : undefined;
        if (Date.now() - combo.current < 600) return; // the second switch of a ▲+▼ press
        if (t && Date.now() - t < 450) {
          // BANK ▲ + ▼ together: Snapshot mode (and back).
          combo.current = Date.now();
          onFsMode(fsMode === "snapshot" ? "stomp" : "snapshot");
          return;
        }
        if (fsMode === "preset" || fsMode === "snapshot") toast.message(`Bank ${face.kind === "up" ? "up" : "down"}: this file is one preset, 01A.`);
        return;
      }
      case "preset":
        if (face.led !== "lit") toast.message("This file is one preset. On the unit it loads into 01A.");
        return;
      default:
        return;
    }
  }

  function holdFace(face: SwitchFace) {
    if (face.kind === "tap") tuner();
    else pressFace(face);
  }

  function renderSwitch(index: number, opts?: { label?: boolean }) {
    const face = faces.find((f) => f.index === index);
    if (!face) return null;
    return (
      <Footswitch
        key={index}
        face={face}
        silk={spec.silk[index]?.toLowerCase() === face.label.toLowerCase() ? undefined : spec.silk[index]}
        number={showFsNumbers && index !== spec.mode && index !== spec.tap ? index : undefined}
        showLabel={opts?.label ?? true}
        selected={fsMode === "stomp" && assignFsIndex === index && spec.stompFs.includes(index)}
        tunerOn={view === "tuner" && face.kind === "tap"}
        tempo={tempo}
        onDown={() => (downs.current[index] = Date.now())}
        onPress={() => pressFace(face)}
        onHold={face.kind === "tap" ? () => holdFace(face) : undefined}
      />
    );
  }

  function paramKnob(p: ParamEntry | undefined, key: string) {
    const range =
      p?.kind === "choice" ? { min: p.min, max: p.max, step: 1 } : p?.kind === "switch" ? { min: 0, max: 10, step: 10 } : {};
    return (
      <Knob
        key={p?.name ?? key}
        label={p?.label ?? "—"}
        value={p?.value ?? 0}
        display={p?.display}
        {...range}
        size={perPage > 3 ? "sm" : largeControls ? "lg" : "md"}
        disabled={!p || !selected}
        onChange={
          p && selected
            ? (v) => {
                if (view !== "edit" && !(layout === "lt" && view === "play") && !helix) onView("edit");
                onChangeParam(selected.id, p.name, v);
              }
            : undefined
        }
      />
    );
  }

  const knobRow = (
    <div className={cn("hx-knob-row", `hx-knob-row-${perPage}`)} aria-label="Parameter knobs">
      {Array.from({ length: perPage }, (_, i) => paramKnob(pageParams[i], `slot-${i}`))}
    </div>
  );

  const lcd = (
    <LcdScreen
      preset={preset}
      spec={spec}
      selectedBlockId={selected?.id ?? null}
      onSelectBlock={(id) => selectBlock(id)}
      view={lcdView}
      fsMode={fsMode}
      paramPage={page}
      activeSnapshot={activeSnapshot}
      faces={faces}
      tempo={tempo}
      showDsp={showDsp}
    />
  );

  // VIEW / ACTION / upper + lower knob / PAGE — HX Stomp, HX Stomp XL and POD Go.
  function onViewBtn() {
    lastView.current = Date.now();
    onView(view === "play" || view === "assign" ? "edit" : "play");
  }
  function onActionBtn() {
    if (Date.now() - lastView.current < 900) {
      toast.success("Saved here. Download the file to put it on the unit.");
      return;
    }
    toast.message("ACTION moves, copies and clears blocks. Do that in HX Edit.");
  }
  function onPageBtn(dir: 1 | -1) {
    if (view === "edit" || layout === "podgo" || helix) {
      onParamPage(page + dir);
      if (layout === "podgo" && view !== "edit") onView("edit");
      return;
    }
    // HX Stomp / XL Play view: PAGE steps the footswitch mode.
    const i = MODE_CYCLE.indexOf(fsMode);
    onFsMode(MODE_CYCLE[(i + dir + MODE_CYCLE.length) % MODE_CYCLE.length]);
  }

  const blockIndex = Math.max(0, blocks.findIndex((b) => b.id === selected?.id));
  const upperKnob = (
    <Knob
      label=""
      ariaLabel="Upper knob: select block, press to turn it on or off"
      value={blockIndex}
      min={0}
      max={Math.max(1, blocks.length - 1)}
      step={1}
      size="sm"
      showValue={false}
      display={selected ? blockModel(selected)?.name : undefined}
      onChange={(v) => {
        const b = blocks[Math.round(v)];
        if (b) selectBlock(b.id);
      }}
      onPress={() => {
        if (view !== "edit") onView("edit");
        else if (selected) toggle(selected.id);
      }}
    />
  );

  const well = (
    <div className="hx-well" role="group" aria-label="View, Action, Page">
      <HwBtn onClick={onViewBtn} label="View">
        <HomeIcon />
      </HwBtn>
      {upperKnob}
      <HwBtn onClick={onActionBtn} label="Action">
        Action
      </HwBtn>
      <span className="hx-silk hx-well-save" aria-hidden>
        Save
      </span>
      <HwBtn onClick={() => onPageBtn(-1)} label="Page back">
        ‹ Page
      </HwBtn>
      <span className="hx-lower-knob" aria-hidden title="Lower knob: model" />
      <HwBtn onClick={() => onPageBtn(1)} label="Page forward">
        Page ›
      </HwBtn>
    </div>
  );

  const brand = (
    <div className="hx-brand" aria-hidden>
      <span className="hx-brand-mark">Line 6</span>
      <span className="hx-brand-mark">{BRAND[layout]}</span>
    </div>
  );

  let board: ReactNode;
  if (layout === "stomp" || layout === "xl") {
    board = (
      <div className={cn("hx-board-compact", layout === "xl" && "hx-board-xl")}>
        <div className="hx-top">
          <div className="hx-top-lcd">{lcd}</div>
          <div className="hx-top-right">
            {layout === "stomp" ? (
              <div className="hx-vol">
                <Knob label="Volume" value={volume} onChange={setVolume} size="sm" />
              </div>
            ) : null}
            {well}
          </div>
        </div>
        <div className="hx-knobs-under">{knobRow}</div>
        <SwitchGrid spec={spec} render={(i) => renderSwitch(i)} />
      </div>
    );
  } else if (layout === "podgo") {
    board = (
      <div className="hx-board-compact hx-board-podgo">
        <div className="hx-top">
          <div className="hx-top-lcd">{lcd}</div>
          <div className="hx-top-right">
            <div className="hx-vol">
              <Knob label="Volume" value={volume} onChange={setVolume} size="sm" />
            </div>
            {well}
          </div>
        </div>
        <div className="hx-knobs-under">{knobRow}</div>
        <div className="hx-podgo-bottom">
          <SwitchGrid spec={spec} render={(i) => renderSwitch(i)} />
          <ExpPedal preset={preset} layout={layout} onToggle={toggle} />
        </div>
      </div>
    );
  } else if (layout === "effects") {
    board = (
      <EffectsBoard
        preset={preset}
        spec={spec}
        faces={faces}
        view={lcdView}
        selectedId={selected?.id}
        onSelect={(id) => onSelectBlock(id)}
        onHome={() => onView("play")}
        onMenu={() => onView(view === "edit" ? "play" : "edit")}
        onSave={() => toast.success("Saved here. Download the file to put it on the unit.")}
        onAction={onActionBtn}
        onPage={(d) => onParamPage(page + d)}
        knobs={knobRow}
        renderSwitch={(i) => renderSwitch(i, { label: false })}
        tunerOn={view === "tuner"}
      />
    );
  } else {
    // Helix Floor / LT.
    const amp = blocks.find((b) => ["amp-guitar", "amp-bass", "preamp"].includes(blockModel(b)?.category ?? ""));
    board = (
      <div className={cn("hx-board-helix", layout === "lt" && "hx-board-lt")}>
        <div className="hx-helix-top">
          <div className="hx-helix-left">
            <HwBtn label="Save" onClick={() => toast.success("Saved here. Download the file to put it on the unit.")}>
              Save
            </HwBtn>
            <div className="hx-preset-knob" aria-hidden>
              <span className="hx-deco-knob" />
              <span className="hx-silk">Preset</span>
            </div>
            <HwBtn
              label={layout === "lt" ? "Home: Performance or Signal Flow view" : "Home"}
              onClick={() => onView(layout === "lt" ? (view === "play" ? "edit" : "play") : "play")}
            >
              <HomeIcon />
            </HwBtn>
            <HwBtn label="Amp" onClick={() => amp && selectBlock(amp.id)}>
              Amp
            </HwBtn>
          </div>
          <div className="hx-helix-lcd">{lcd}</div>
          <div className="hx-helix-right">
            <div className="hx-helix-vols">
              <Knob label="Volume" value={volume} onChange={setVolume} size="sm" />
              {layout === "floor" ? <Knob label="Phones" value={phones} onChange={setPhones} size="sm" /> : null}
            </div>
            <div className="hx-helix-nav">
              <HwBtn label="Bypass selected block" onClick={() => selected && toggle(selected.id)}>
                Bypass
              </HwBtn>
              <HwBtn label="Action" onClick={onActionBtn}>
                Action
              </HwBtn>
              <Joystick onStep={stepBlock} />
              <HwBtn label="Page back" onClick={() => onParamPage(page - 1)}>
                ‹
              </HwBtn>
              <HwBtn label="Page forward" onClick={() => onParamPage(page + 1)}>
                ›
              </HwBtn>
            </div>
          </div>
        </div>
        <div className="hx-knobs-under hx-knobs-helix">{knobRow}</div>
        <div className="hx-helix-bottom">
          <div className="hx-helix-switches">
            {spec.rows.map((row, r) => (
              <div key={r} className="hx-helix-row">
                {row.map((index) => (
                  <div key={index} className="hx-helix-cell">
                    {layout === "floor" ? <Scribble face={faces.find((f) => f.index === index)} /> : null}
                    {renderSwitch(index, { label: layout === "lt" })}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <ExpPedal preset={preset} layout={layout} onToggle={toggle} />
        </div>
      </div>
    );
  }

  return (
    <div className="hx-replica-scroll min-w-0">
      <div className={cn("hx-chassis mx-auto w-full", `hx-chassis-${layout}`)} data-layout={layout}>
        <div className="hx-sparkle" aria-hidden />
        {brand}
        {board}
      </div>
    </div>
  );
}

function SwitchGrid({ spec, render }: { spec: UnitSpec; render: (index: number) => ReactNode }) {
  return (
    <div className="hx-switches" style={{ ["--cols" as string]: spec.rows[0].length }}>
      {spec.rows.flat().map((i) => (
        <div key={i} className="hx-switch-cell">
          {render(i)}
        </div>
      ))}
    </div>
  );
}

function EffectsBoard({
  preset,
  spec,
  faces,
  view,
  selectedId,
  onSelect,
  onHome,
  onMenu,
  onSave,
  onAction,
  onPage,
  knobs,
  renderSwitch,
  tunerOn,
}: {
  preset: Preset;
  spec: UnitSpec;
  faces: SwitchFace[];
  view: "play" | "edit" | "tuner";
  selectedId?: string;
  onSelect: (id: string) => void;
  onHome: () => void;
  onMenu: () => void;
  onSave: () => void;
  onAction: () => void;
  onPage: (dir: 1 | -1) => void;
  knobs: ReactNode;
  renderSwitch: (index: number) => ReactNode;
  tunerOn: boolean;
}) {
  // No main screen: six scribble strips are the display. Menu > Signal Flow puts the blocks on them.
  const blocks = sortedBlocks(preset);
  const [flowPage, setFlowPage] = useState(0);
  const flowPages = Math.max(1, Math.ceil(blocks.length / 6));
  const fp = Math.min(flowPage, flowPages - 1);
  const stripFs = [1, 2, 3, 4, 5, 6];
  const selected = blocks.find((b) => b.id === selectedId);
  const model = selected ? blockModel(selected) : undefined;

  function strip(index: number) {
    if (tunerOn) return <div className="hx-scribble hx-scribble-dim">{index === 2 ? "Tuner" : index === 3 ? "—" : ""}</div>;
    if (view === "edit") {
      const b = blocks[fp * 6 + stripFs.indexOf(index)];
      if (!b) return <div className="hx-scribble hx-scribble-dim" />;
      const m = blockModel(b);
      return (
        <button
          type="button"
          className={cn("hx-scribble hx-scribble-btn", b.id === selectedId && "hx-scribble-sel", !b.enabled && "hx-scribble-dim")}
          style={{ ["--face" as string]: m ? CATEGORY_MAP[m.category].lcd : "#9aa3ad" }}
          onClick={() => onSelect(b.id)}
        >
          {fitSwitchLabel(m?.name ?? "Block", 8)}
        </button>
      );
    }
    return <Scribble face={faces.find((f) => f.index === index)} selected={Boolean(selectedId) && faces.find((f) => f.index === index)?.blockId === selectedId} />;
  }

  return (
    <div className="hx-board-effects">
      <div className="hx-fx-top">
        <div className="hx-fx-left">
          <HwBtn label="Save" onClick={onSave}>
            Save
          </HwBtn>
          <HwBtn label={view === "edit" ? "Menu: close Signal Flow" : "Menu: Signal Flow"} onClick={onMenu} pressed={view === "edit"}>
            Menu
          </HwBtn>
          <HwBtn label="Home" onClick={onHome}>
            <HomeIcon />
          </HwBtn>
        </div>
        <div className="hx-fx-big" aria-hidden>
          <span className="hx-deco-knob hx-deco-knob-big" />
          <span className="hx-silk">{model ? fitSwitchLabel(model.name, 12) : "Big knob"}</span>
        </div>
        <div className="hx-fx-right">
          <HwBtn label="Action" onClick={onAction}>
            Action
          </HwBtn>
          <div className="flex gap-1">
            <HwBtn label="Page back" onClick={() => (view === "edit" ? setFlowPage((fp - 1 + flowPages) % flowPages) : onPage(-1))}>
              ◀
            </HwBtn>
            <HwBtn label="Page forward" onClick={() => (view === "edit" ? setFlowPage((fp + 1) % flowPages) : onPage(1))}>
              ▶
            </HwBtn>
          </div>
        </div>
      </div>
      <div className="hx-knobs-under">{knobs}</div>
      <div className="hx-switches hx-switches-fx" style={{ ["--cols" as string]: 4 }}>
        {spec.rows.flat().map((i) => (
          <div key={i} className="hx-switch-cell">
            {stripFs.includes(i) ? strip(i) : <div className="hx-scribble-spacer" />}
            {renderSwitch(i)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Scribble({ face, selected }: { face?: SwitchFace; selected?: boolean }) {
  if (!face) return <div className="hx-scribble hx-scribble-dim" />;
  const empty = face.kind === "empty" || !face.label;
  return (
    <div
      className={cn(
        "hx-scribble",
        face.led === "lit" && "hx-scribble-on",
        empty && "hx-scribble-dim",
        selected && "hx-scribble-sel",
      )}
      style={{ ["--face" as string]: face.color }}
    >
      {empty ? "" : fitSwitchLabel(face.label, 8)}
    </div>
  );
}

function Footswitch({
  face,
  silk,
  number,
  showLabel,
  selected,
  tunerOn,
  tempo,
  onDown,
  onPress,
  onHold,
}: {
  face: SwitchFace;
  silk?: string;
  number?: number;
  showLabel: boolean;
  selected?: boolean;
  tunerOn?: boolean;
  tempo: number;
  onDown: () => void;
  onPress: () => void;
  onHold?: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  // Down starts the hold timer (and the ▲+▼ timing); the press itself fires on click, so assistive tech works too.
  function start() {
    held.current = false;
    onDown();
    if (onHold) {
      timer.current = window.setTimeout(() => {
        held.current = true;
        onHold();
      }, 800);
    }
  }
  function stop() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }

  const label = face.label ? fitSwitchLabel(face.label, 8) : "";
  const blink = face.kind === "tap" && !tunerOn;
  const name = face.kind === "empty" ? "nothing assigned" : face.kind === "tap" ? "Tap tempo, hold for tuner" : face.label;
  return (
    <button
      type="button"
      data-fs={face.index}
      data-kind={face.kind}
      aria-label={`Switch ${face.index}: ${name}${face.kind === "stomp" ? (face.led === "lit" ? ", on" : ", off") : ""}${face.kind === "snapshot" && face.led === "lit" ? ", active" : ""}`}
      aria-pressed={face.kind === "stomp" || face.kind === "snapshot" ? face.led === "lit" : undefined}
      className={cn("hx-footswitch", selected && "hx-footswitch-sel")}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // Hold Space for the hold function (TAP → tuner); a quick Space or Enter is a press.
        if (e.key === " " && !e.repeat) start();
      }}
      onKeyUp={(e) => {
        if (e.key === " ") stop();
      }}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onPress();
      }}
    >
      <span
        className={cn("hx-fs-cap", `hx-led-${face.led}`, blink && "hx-led-blink", tunerOn && "hx-led-lit")}
        style={{ ["--led" as string]: face.color, ["--beat" as string]: `${60 / Math.max(40, tempo)}s` }}
      >
        {number ? <span className="hx-fs-num">{number}</span> : null}
      </span>
      {showLabel ? <span className={cn("hx-fs-label", !label && "hx-fs-label-empty")}>{label || "—"}</span> : null}
      {silk ? <span className="hx-silk hx-fs-silk">{silk}</span> : null}
    </button>
  );
}

function ExpPedal({
  preset,
  layout,
  onToggle,
}: {
  preset: Preset;
  layout: string;
  onToggle: (blockId: string) => void;
}) {
  const { wah, vol } = pedalTargets(preset);
  const [exp, setExp] = useState<1 | 2>(wah?.enabled ? 1 : 2);
  const [pos, setPos] = useState(100);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const target = exp === 1 ? wah : vol;
  const targetName = target ? blockModel(target)?.name : exp === 1 ? "Wah" : "Volume";

  function toe() {
    const next = exp === 1 ? 2 : 1;
    setExp(next);
    // The toe switch engages the wah when the pedal goes to EXP 1, and bypasses it on EXP 2.
    if (wah && (next === 1) !== wah.enabled) onToggle(wah.id);
  }

  return (
    <div className="hx-exp">
      {layout === "floor" ? (
        <div className="hx-scribble hx-scribble-on hx-exp-strip" style={{ ["--face" as string]: exp === 1 ? "#e24a3a" : "#22e06a" }}>
          EXP {exp} {Math.round(pos)}%
        </div>
      ) : (
        <div className="hx-exp-leds" aria-hidden>
          <span className={cn("hx-exp-led", exp === 1 && "hx-exp-led-on")} style={{ ["--led" as string]: "#e24a3a" }} />
          <span className="hx-silk">{layout === "podgo" ? "Wah" : "Exp 1"}</span>
          <span className={cn("hx-exp-led", exp === 2 && "hx-exp-led-on")} style={{ ["--led" as string]: "#22e06a" }} />
          <span className="hx-silk">{layout === "podgo" ? "Vol" : "Exp 2"}</span>
        </div>
      )}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Expression pedal, EXP ${exp}${targetName ? ` (${targetName})` : ""}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        className="hx-exp-tread"
        style={{ ["--tilt" as string]: `${(pos / 100) * 16 - 8}deg` }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, v: pos };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos(Math.max(0, Math.min(100, drag.current.v + (drag.current.y - e.clientY) * 0.8)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 5 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -5 : 0;
          if (!d) return;
          e.preventDefault();
          setPos((p) => Math.max(0, Math.min(100, p + d)));
        }}
      />
      <button type="button" className="hx-hw-btn hx-exp-toe" onClick={toe} aria-label={`Toe switch: EXP ${exp}. Press for EXP ${exp === 1 ? 2 : 1}`}>
        Toe
      </button>
    </div>
  );
}

function Joystick({ onStep }: { onStep: (dir: 1 | -1) => void }) {
  return (
    <div className="hx-joystick-wrap" role="group" aria-label="Joystick: select block">
      <button type="button" className="hx-joy-arrow" aria-label="Previous block" onClick={() => onStep(-1)}>
        ‹
      </button>
      <span className="hx-joystick" aria-hidden />
      <button type="button" className="hx-joy-arrow" aria-label="Next block" onClick={() => onStep(1)}>
        ›
      </button>
    </div>
  );
}

function HwBtn({
  children,
  onClick,
  label,
  pressed,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  pressed?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="hx-hw-btn" aria-label={label} aria-pressed={pressed}>
      {children}
    </button>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h8V6.5" />
    </svg>
  );
}
