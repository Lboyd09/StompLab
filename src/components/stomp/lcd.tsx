import { CATEGORY_MAP } from "@/data/categories";
import type { Preset, StompBlock } from "@/data/types";
import { blockModel, dspLoad, paramEntries, sortedBlocks } from "@/lib/preset-utils";
import { cn } from "@/lib/utils";
import { fitSwitchLabel, type FsMode, type SwitchFace, type UnitSpec } from "./hardware";

type Props = {
  preset: Preset;
  spec: UnitSpec;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  /** play / edit / tuner. On Helix LT, play is Performance view and edit is Signal Flow. */
  view: "play" | "edit" | "tuner";
  fsMode: FsMode;
  /** Already wrapped to the block's page count. */
  paramPage: number;
  activeSnapshot: number;
  faces: SwitchFace[];
  tempo: number;
  showDsp?: boolean;
};

const MODE_TAG: Record<FsMode, string> = { stomp: "Stomp", snapshot: "Snapshot", preset: "Preset" };

/**
 * The unit's main screen.
 * HX Stomp / XL / POD Go: Play view = preset name + footswitch labels; Edit view = signal flow + parameters.
 * Helix Floor: signal flow with the six parameters above the knobs.
 * Helix LT: Performance view (big boxes for the middle eight switches) or Signal Flow.
 */
export function LcdScreen({
  preset,
  spec,
  selectedBlockId,
  onSelectBlock,
  view,
  fsMode,
  paramPage,
  activeSnapshot,
  faces,
  tempo,
  showDsp = true,
}: Props) {
  const blocks = sortedBlocks(preset);
  const selected = blocks.find((b) => b.id === selectedBlockId) ?? blocks[0];
  const snap = preset.snapshots[activeSnapshot];
  const helix = spec.layout === "floor" || spec.layout === "lt";
  const load = dspLoad(preset);

  const header = (
    <div className="hx-lcd-head">
      <span className="hx-lcd-slot">01A</span>
      <span className="hx-lcd-name">{preset.name}</span>
      <span className="hx-lcd-meta">
        <span>{MODE_TAG[fsMode]}</span>
        <span className="tabular-nums">{tempo} BPM</span>
        {showDsp && (view === "edit" || helix) ? (
          <span className={cn("tabular-nums", load > 90 ? "text-red-400" : load > 75 ? "text-amber-300" : "text-emerald-400")}>
            {load}%
          </span>
        ) : null}
      </span>
    </div>
  );

  let body: React.ReactNode;
  if (view === "tuner") {
    body = <TunerView />;
  } else if (spec.layout === "lt" && view === "play") {
    body = (
      <>
        <FaceGrid faces={pick(faces, [2, 3, 4, 5, 8, 9, 10, 11])} cols={4} big />
        <ParamStrip block={selected} page={paramPage} perPage={spec.knobs} />
      </>
    );
  } else if (helix || view === "edit") {
    body = (
      <>
        <SignalFlow blocks={blocks} selectedId={selected?.id} onSelect={helix ? onSelectBlock : undefined} />
        <ParamStrip block={selected} page={paramPage} perPage={spec.knobs} showName />
      </>
    );
  } else {
    // Play view: big preset name, snapshot under it, then the footswitch labels laid out like the switches.
    const rows =
      spec.layout === "stomp"
        ? [[1, 2, 3]]
        : [
            [1, 2, 3],
            [4, 5, 6],
          ];
    body = (
      <>
        <div className="hx-lcd-play">
          <span className="hx-lcd-play-slot">01A · {tempo} BPM</span>
          <span className="hx-lcd-play-name">{preset.name}</span>
          {snap && fsMode === "snapshot" ? (
            <span className="hx-lcd-play-snap" style={{ color: snap.color }}>
              {snap.name}
            </span>
          ) : null}
        </div>
        <div className="hx-lcd-boxes">
          {rows.map((row, i) => (
            <FaceGrid key={i} faces={pick(faces, row)} cols={row.length} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={cn("hx-lcd", helix && "hx-lcd-wide")} data-view={view}>
      {view === "play" && !helix ? null : header}
      {body}
    </div>
  );
}

function pick(faces: SwitchFace[], order: number[]) {
  return order.map((i) => faces.find((f) => f.index === i)).filter((f): f is SwitchFace => Boolean(f));
}

function FaceGrid({ faces, cols, big }: { faces: SwitchFace[]; cols: number; big?: boolean }) {
  return (
    <div className={cn("hx-lcd-facegrid", big && "hx-lcd-facegrid-big")} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {faces.map((f) => (
        <div
          key={f.index}
          className={cn("hx-lcd-face", f.led === "lit" && "hx-lcd-face-on", f.kind === "empty" && "hx-lcd-face-empty")}
          style={{ ["--face" as string]: f.color }}
        >
          <span className="hx-lcd-face-bar" />
          <span className="hx-lcd-face-label">{f.label ? fitSwitchLabel(f.label, big ? 9 : 7) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function SignalFlow({
  blocks,
  selectedId,
  onSelect,
}: {
  blocks: StompBlock[];
  selectedId?: string;
  /** Helix: tap a block. The small screens select with the upper knob, as the hardware does. */
  onSelect?: (id: string) => void;
}) {
  // The unit draws an amp and its cab as one block, so the whole chain fits the screen.
  const shown = blocks.filter(
    (b, i) =>
      !(
        blockModel(b)?.category === "cab" &&
        i > 0 &&
        ["amp-guitar", "amp-bass", "preamp"].includes(blockModel(blocks[i - 1])?.category ?? "")
      ),
  );
  return (
    <div className="hx-lcd-flow">
      <span className="hx-lcd-io">In</span>
      <div className="hx-lcd-flow-row">
        <span className="hx-path-line" aria-hidden />
        {shown.map((b) => (
          <BlockChip key={b.id} block={b} selected={b.id === selectedId} onClick={onSelect ? () => onSelect(b.id) : undefined} />
        ))}
      </div>
      <span className="hx-lcd-io">Out</span>
    </div>
  );
}

function BlockChip({ block, selected, onClick }: { block: StompBlock; selected: boolean; onClick?: () => void }) {
  const model = blockModel(block);
  const color = model ? CATEGORY_MAP[model.category].lcd : "#9aa3ad";
  const chip = (
    <span className={cn("hx-lcd-chip", selected && "hx-lcd-chip-sel", !block.enabled && "hx-lcd-chip-off")}>
      <span className="hx-lcd-chip-bar" style={{ background: color }} />
      <span className="hx-lcd-chip-text">{model?.abbrev ?? "—"}</span>
    </span>
  );
  if (!onClick) return <span className="hx-lcd-chip-hit hx-lcd-chip-static">{chip}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hx-lcd-chip-hit"
      aria-label={`${model?.name ?? "Block"}${block.enabled ? "" : " (off)"}`}
      aria-pressed={selected}
    >
      {chip}
    </button>
  );
}

function ParamStrip({
  block,
  page,
  perPage,
  showName,
}: {
  block: StompBlock | undefined;
  page: number;
  perPage: number;
  showName?: boolean;
}) {
  const model = block ? blockModel(block) : undefined;
  const params = block ? paramEntries(block) : [];
  const pages = Math.max(1, Math.ceil(params.length / perPage));
  const row = params.slice(page * perPage, page * perPage + perPage);
  return (
    <div className="hx-lcd-params">
      {showName && model ? (
        <div className="hx-lcd-params-head">
          <span className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_MAP[model.category].lcd }} />
          <span className="min-w-0 flex-1 truncate">{model.name}</span>
          {block && !block.enabled ? <span className="text-zinc-500">Off</span> : null}
          <span className="tabular-nums text-zinc-500">
            {page + 1}/{pages}
          </span>
        </div>
      ) : null}
      <div className="hx-lcd-params-row" style={{ gridTemplateColumns: `repeat(${perPage}, minmax(0, 1fr))` }}>
        {Array.from({ length: perPage }, (_, i) => {
          const p = row[i];
          return (
            <div key={p?.name ?? `e-${i}`} className="hx-lcd-param">
              <span className="hx-lcd-param-label">{p?.label ?? ""}</span>
              <span className="hx-lcd-param-value">{p?.display ?? ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TunerView() {
  return (
    <div className="hx-lcd-tuner" role="status">
      <div className="hx-lcd-tuner-note">—</div>
      <div className="hx-lcd-tuner-scale" aria-hidden>
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className={cn(i === 5 && "hx-lcd-tuner-mid")} />
        ))}
      </div>
      <div className="hx-lcd-tuner-hint">Tuner · play a string</div>
      <div className="hx-lcd-tuner-hint">Press any switch to exit</div>
    </div>
  );
}
