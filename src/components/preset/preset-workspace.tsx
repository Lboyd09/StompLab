import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset, StompBlock } from "@/data/types";
import { copyHlx, downloadHlx, hlxFilename, hlxJson, canExportHlx } from "@/lib/hlx";
import {
  blockModel,
  canDownloadPreset,
  deviceFor,
  dspLoad,
  featuredOriginal,
  isDemoId,
  isFeaturedKnownId,
  paramEntries,
  sortedBlocks,
  withSnapshot,
  withStompModel,
  unitSwitchText,
} from "@/lib/preset-utils";
import { isAmpOrCab } from "@/lib/snapshot-sanitize";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Share2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StompUnit } from "../stomp/stomp-unit";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FsAssignPanel, stompSwitchIndices } from "./fs-assign";
import { unitSpec } from "../stomp/hardware";
import { DownloadBar, EXPORT_MODE_LABEL, type ExportMode } from "./download-bar";
import { FREE_BUILD_LINE } from "@/lib/copy";
import { PostDownloadDialog, shouldAskAgain } from "../layout/post-download";
import { RigDisclaimer } from "../layout/disclaimer";
import { IrNote } from "./ir-note";
import { revisePresetFn } from "@/lib/research";
import { sharePresetFn } from "@/lib/share";
import { copyText } from "@/lib/clipboard";
import { trackDownload } from "@/lib/track";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { WahSelect } from "../layout/wah-select";
import { applyWahPreference, parseWahMode, type WahMode } from "@/lib/wah";

export function PresetWorkspace({
  preset,
  onChange: onChangeProp,
  readOnly = false,
  signInToDownload,
}: {
  preset: Preset;
  onChange?: (next: Preset) => void;
  /** Shared link: no edits, no revise, no feedback. */
  readOnly?: boolean;
  /** Where to come back to after signing in. Set on a shared link: download needs an account. */
  signInToDownload?: string;
}) {
  const onChange = (next: Preset) => {
    if (!readOnly) onChangeProp?.(next);
  };
  const selectedBlockId = useAppStore((s) => s.selectedBlockId);
  const selectBlock = useAppStore((s) => s.selectBlock);
  const lcdView = useAppStore((s) => s.lcdView);
  const setLcdView = useAppStore((s) => s.setLcdView);
  const fsMode = useAppStore((s) => s.fsMode);
  const setFsMode = useAppStore((s) => s.setFsMode);
  const paramPage = useAppStore((s) => s.paramPage);
  const setParamPage = useAppStore((s) => s.setParamPage);
  const activeSnapshot = useAppStore((s) => s.activeSnapshot);
  const setActiveSnapshot = useAppStore((s) => s.setActiveSnapshot);
  const assignFsIndex = useAppStore((s) => s.assignFsIndex);
  const setAssignFsIndex = useAppStore((s) => s.setAssignFsIndex);
  const defaultFsMode = useAppStore((s) => s.defaultFsMode);
  const showDsp = useAppStore((s) => s.showDsp);
  const confirmDownload = useAppStore((s) => s.confirmDownload);
  const wahMode = useAppStore((s) => s.wahMode);
  const wahModelId = useAppStore((s) => s.wahModelId);
  const setWahMode = useAppStore((s) => s.setWahMode);
  const setWahModelId = useAppStore((s) => s.setWahModelId);
  const { plan, isPending: planPending } = usePlan();
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showReplica, setShowReplica] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [revising, setRevising] = useState<string | null>(null);
  // One choice drives the page and the file: Stomp shows effects on the switches, Snapshot shows song parts.
  const exportMode: ExportMode = fsMode === "stomp" ? "stomp" : "snapshot";
  const stompMode = fsMode === "stomp";
  // Snapshot N sits on a different switch per unit (XL: FS5, FS6, FS2…; Helix: FS8–11).
  const snapFs = unitSpec(deviceFor(preset).layout).snapshotFs;
  const setExportMode = (mode: ExportMode) => {
    setFsMode(mode);
    if (mode !== "stomp") return;
    setActiveSnapshot(0);
    if (readOnly || preset.footswitches.some((f) => f.action === "bypass")) return;
    // First time in Stomp mode: put the chain's effects on the switches, in order.
    const effects = sortedBlocks(preset).filter((b) => !isAmpOrCab(b.modelId) && blockModel(b));
    const picks: FootswitchAssign[] = stompSwitchIndices(preset)
      .slice(0, effects.length)
      .map((index, i) => {
        const model = blockModel(effects[i])!;
        return {
          index,
          label: model.abbrev,
          color: CATEGORY_MAP[model.category].lcd,
          action: "bypass",
          targetBlockId: effects[i].id,
          notes: `Toggle ${model.name}`,
        };
      });
    if (picks.length) onChange({ ...preset, footswitches: [...preset.footswitches, ...picks] });
  };
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState<"download" | "rate" | null>(null);
  const [beforeRevise, setBeforeRevise] = useState<Preset | null>(null);
  const device = deviceFor(preset);
  const load = dspLoad(preset);
  const displayed = withSnapshot(preset, activeSnapshot);
  const original = featuredOriginal(preset.id);
  const isPodGo = preset.stompModel === "pod-go";
  const editor = isPodGo ? "POD Go Edit" : "HX Edit";
  const exportExt = isPodGo ? "pgp" : "hlx";
  const canDownload = signInToDownload
    ? !planPending && plan.signedIn
    : planPending
      ? isDemoId(preset.id) || !isFeaturedKnownId(preset.id)
      : canDownloadPreset(preset.id, plan);
  const canShare = !readOnly && (preset.source === "featured" || (!planPending && plan.signedIn));

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      let url: string;
      if (preset.source === "featured") {
        url = `${window.location.origin}/preset/${encodeURIComponent(preset.id)}`;
      } else {
        const res = await sharePresetFn({ data: { preset } });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        url = `${window.location.origin}/s/${res.shareId}`;
      }
      const title = `${preset.song || preset.name} · Stomp Lab preset for ${device.name}`;
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ url, title });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      if (await copyText(url)) toast.success("Link copied");
      else toast.error("Could not copy the link.");
    } catch {
      toast.error("Could not make a link. Try again.");
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    if (defaultFsMode === "snapshot") setFsMode("snapshot");
    else if (defaultFsMode === "stomp") setFsMode("stomp");
    else {
      const snaps = preset.footswitches.filter((f) => f.action === "snapshot").length;
      const stomps = preset.footswitches.filter((f) => f.action === "bypass").length;
      setFsMode(snaps > 0 && snaps >= stomps ? "snapshot" : "stomp");
    }
    setActiveSnapshot(0);
    setLcdView("play");
    setAssignFsIndex(1);
    setSavedFile(null);
    setAskOpen(!readOnly && shouldAskAgain(preset.id) ? "rate" : null);
    setBeforeRevise(null);
    // Intentionally keyed on preset.id so knob edits don't reset the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, preset.stompModel, defaultFsMode, setFsMode, setActiveSnapshot, setLcdView, setAssignFsIndex]);

  function changeParam(blockId: string, name: string, value: number) {
    const target = stompMode ? 0 : activeSnapshot;
    const snap = preset.snapshots[target];
    if (snap) {
      onChange({
        ...preset,
        snapshots: preset.snapshots.map((s, i) =>
          i === target
            ? {
                ...s,
                paramOverrides: {
                  ...s.paramOverrides,
                  [blockId]: { ...(s.paramOverrides?.[blockId] ?? {}), [name]: value },
                },
              }
            : s,
        ),
      });
      return;
    }
    onChange({
      ...preset,
      blocks: preset.blocks.map((b) =>
        b.id === blockId ? { ...b, params: { ...b.params, [name]: value } } : b,
      ),
    });
  }

  function toggleBlock(blockId: string) {
    const block = preset.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const target = stompMode ? 0 : activeSnapshot;
    const snap = preset.snapshots[target];
    if (snap) {
      const on = snap.enabledBlocks.includes(blockId);
      if (on && isAmpOrCab(block.modelId)) {
        toast.message("Amp and cab stay on. Turning them off makes that snapshot silent.");
        return;
      }
      const enabledBlocks = on
        ? snap.enabledBlocks.filter((id) => id !== blockId)
        : [...snap.enabledBlocks, blockId];
      onChange({
        ...preset,
        snapshots: preset.snapshots.map((s, i) => (i === target ? { ...s, enabledBlocks } : s)),
      });
      return;
    }
    if (block.enabled && isAmpOrCab(block.modelId)) {
      toast.message("Amp and cab stay on. Turning them off makes the preset silent.");
      return;
    }
    onChange({
      ...preset,
      blocks: preset.blocks.map((b) => (b.id === blockId ? { ...b, enabled: !b.enabled } : b)),
    });
  }

  function renameSnapshot(id: string, name: string) {
    const nextName = name.slice(0, 12);
    onChange({
      ...preset,
      snapshots: preset.snapshots.map((s) => (s.id === id ? { ...s, name: nextName } : s)),
      footswitches: preset.footswitches.map((f) =>
        f.snapshotId === id ? { ...f, label: nextName.slice(0, 8).toUpperCase() } : f,
      ),
    });
  }

  function onWahMode(mode: WahMode) {
    setWahMode(mode);
    onChange(applyWahPreference(preset, mode, wahModelId));
  }

  function onWahModel(id: string) {
    setWahModelId(id);
    onChange(applyWahPreference(preset, parseWahMode(wahMode), id));
  }

  function assignFs(index: number, patch: Partial<FootswitchAssign> | null) {
    // Stomp assignments and snapshot switches share numbers; only replace the stomp one.
    const rest = preset.footswitches.filter(
      (f) =>
        !(f.action === "bypass" && (f.index === index || (patch?.targetBlockId && f.targetBlockId === patch.targetBlockId))),
    );
    if (!patch) {
      onChange({ ...preset, footswitches: rest });
      return;
    }
    const existing = preset.footswitches.find((f) => f.index === index && f.action === "bypass");
    const nextAssign: FootswitchAssign = {
      index,
      label: patch.label ?? existing?.label ?? `FS${index}`,
      color: patch.color ?? existing?.color ?? "#c5c9c2",
      action: patch.action ?? existing?.action ?? "bypass",
      targetBlockId: "targetBlockId" in patch ? patch.targetBlockId : existing?.targetBlockId,
      snapshotId: "snapshotId" in patch ? patch.snapshotId : existing?.snapshotId,
      notes: patch.notes ?? existing?.notes ?? "",
    };
    onChange({ ...preset, footswitches: [...rest, nextAssign].sort((a, b) => a.index - b.index) });
  }

  function resetFeatured() {
    if (!original) return;
    onChange(withStompModel({ ...original, createdAt: preset.createdAt }, preset.stompModel));
    toast.success("Switches restored to the original rig.");
  }

  function onDownload() {
    if (!canDownload) return;
    if (!canExportHlx(preset.stompModel)) {
      toast.error(
        `${device.name} does not export a preset file. Copy the chain below by hand.`,
      );
      return;
    }
    const filename = hlxFilename(preset);
    if (confirmDownload && !window.confirm(`Download ${filename} for ${editor}?`)) return;
    const ok = downloadHlx(preset, { fsMode: exportMode });
    if (ok) {
      trackDownload();
      setSavedFile(filename);
      setAskOpen("download");
    }
    else toast.error(`Download was blocked. Use Advanced, then Copy JSON, and save it as a .${exportExt} file.`);
  }

  async function onRevise(note: string) {
    if (!plan.signedIn) return;
    if (!plan.canResearch) return;
    const before = preset;
    setRevising(note);
    try {
      const current = sortedBlocks(preset)
        .map((b) => {
          const m = blockModel(b);
          return m ? `${m.name}${b.enabled ? "" : " off"}` : "";
        })
        .filter(Boolean)
        .join(" → ");
      const result = await revisePresetFn({
        data: {
          song: preset.song || preset.name,
          artist: preset.artist,
          instrument: preset.instrument,
          stompModel: preset.stompModel,
          note,
          playbackTarget: preset.playbackTarget,
          current,
          userGear: [],
        },
      });
      if (!result.ok) {
        notifyResearchError(result, { login: () => undefined, upgrade: () => undefined });
        return;
      }
      onChange(result.preset);
      setBeforeRevise(before);
      toast.success("Tone revised.", { action: { label: "Undo", onClick: () => undoRevise(before) } });
      notifyResearchSource(result.source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revise.");
    } finally {
      setRevising(null);
    }
  }

  function undoRevise(prev: Preset | null = beforeRevise) {
    if (!prev) return;
    onChange(prev);
    setBeforeRevise(null);
    toast.message("Back to the earlier tone.");
  }

  async function onCopy() {
    if (!canDownload) return;
    setCopying(true);
    try {
      await copyHlx(preset, { fsMode: exportMode });
      toast.success(`${editor} JSON copied. Paste into a text file named .${exportExt} and import it.`);
    } catch {
      toast.error(`Could not copy. Try Download .${exportExt} instead.`);
    } finally {
      setCopying(false);
    }
  }

  const layout = device.layout;
  const spec = unitSpec(layout);
  const chain = sortedBlocks(displayed).filter((b) => blockModel(b));
  const selectedId = chain.some((b) => b.id === selectedBlockId) ? selectedBlockId : chain[0]?.id;
  const selectedBlock = chain.find((b) => b.id === selectedId);
  const activeSnap = preset.snapshots[activeSnapshot];
  // Demo notes are written for the HX Stomp's switches; name the real ones on this unit.
  const noteText = (t: string) => (preset.source === "featured" ? unitSwitchText(t, unitSpec(deviceFor(preset).layout).snapshotFs) : t);
  // Standard tuning needs no badge; only a retune is worth flagging.
  const tuning = preset.tips.find((t) => /^tune /i.test(t) && !/^tune (to )?e standard\b/i.test(t));
  const tuningName = tuning ? (tuning.match(/\(([^)]+)\)/)?.[1] ?? tuning.replace(/[.,].*$/, "")) : null;
  const otherTips = preset.tips.filter((t) => t !== tuning);
  const fs = (n: number | undefined) => (n ? `FS${n}` : "");
  const modeSteps =
    layout === "stomp"
      ? exportMode === "snapshot"
        ? "On the home screen, press PAGE until the switch labels show the song parts."
        : "On the home screen, press PAGE until the switch labels show the effects."
      : exportMode === "snapshot"
        ? `Press ▲ and ▼ together (${fs(spec.up)} + ${fs(spec.down)}) so the switches show the song parts.`
        : `Press MODE (${fs(spec.mode)}) until the switches show the effects.`;

  /** Switch that turns this block on and off in Stomp mode, where the unit shows one. */
  const stompFsFor = (blockId: string) =>
    preset.footswitches.find((f) => f.action === "bypass" && f.targetBlockId === blockId && spec.stompFs.includes(f.index))?.index;

  function pickPart(i: number) {
    setActiveSnapshot(i);
    setFsMode("snapshot");
  }

  return (
    <>
      <div className="space-y-6 pb-24">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span>{preset.instrument}</span>
            <span aria-hidden>·</span>
            <span className="font-medium text-foreground">{device.name}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{preset.tempo} BPM</span>
            {tuningName ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-amber-300">{tuningName}</span>
              </>
            ) : null}
            {showDsp ? (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{load}% DSP</span>
              </>
            ) : null}
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
            {preset.song ? (
              <>
                {preset.song}
                {preset.artist ? <span className="block text-lg font-normal text-muted-foreground sm:inline sm:text-3xl"><span className="hidden sm:inline"> — </span>{preset.artist}</span> : null}
              </>
            ) : (
              preset.name
            )}
          </h1>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {canDownload && canExportHlx(preset.stompModel) && !readOnly ? (
              <Button type="button" className="h-11 w-full sm:w-auto" onClick={onDownload} data-tour="download">
                Download .{exportExt}
              </Button>
            ) : null}
            <div className="flex gap-2">
              {canShare ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 flex-1 sm:flex-none"
                  disabled={sharing}
                  onClick={() => void onShare()}
                >
                  <Share2 className="size-4" />
                  {sharing ? "Making link" : "Share"}
                </Button>
              ) : null}
              {readOnly ? null : (
                <Button asChild variant="ghost" className="h-11 flex-1 sm:flex-none">
                  <Link to="/setlist" search={{ add: preset.id }}>Add to setlist</Link>
                </Button>
              )}
            </div>
          </div>
          {canDownload ? null : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {signInToDownload
                ? `Sign in to download. ${FREE_BUILD_LINE}`
                : isDemoId(preset.id)
                  ? "We could not confirm your account. Reload the page and try again."
                  : "You can look around. Subscribe to download this one; the demos stay free."}
            </p>
          )}
          <div className="max-w-2xl">
            <p className={`text-sm leading-relaxed text-muted-foreground ${showSummary ? "" : "line-clamp-2"}`}>{preset.summary}</p>
            {preset.summary.length > 110 ? (
              <button
                type="button"
                aria-expanded={showSummary}
                onClick={() => setShowSummary((open) => !open)}
                className="min-h-11 text-xs text-primary underline underline-offset-2"
              >
                {showSummary ? "Less" : "More about this tone"}
              </button>
            ) : null}
          </div>
          {!canExportHlx(preset.stompModel) ? (
            <p className="text-sm text-muted-foreground">
              {device.name} does not export a preset file. Copy the chain below by hand.
            </p>
          ) : isPodGo ? (
            <p className="text-sm text-muted-foreground">
              POD Go Edit imports .pgp files (File → Import). A Helix .hlx will not load on this unit.
            </p>
          ) : null}
          <IrNote preset={preset} />
        </header>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="tone-heading" className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="tone-heading" className="font-display text-lg font-semibold">
                    The tone
                  </h2>
                  <span className="text-xs text-muted-foreground">How the switches work</span>
                </div>
                <div role="radiogroup" aria-label="How the switches work" className="grid grid-cols-2 rounded-full bg-secondary p-1">
                  {(
                    [
                      ["snapshot", "Song parts", "Snapshot mode"],
                      ["stomp", "Effects", "Stomp mode"],
                    ] as const
                  ).map(([id, label, sub]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={exportMode === id}
                      onClick={() => {
                        setExportMode(id);
                        setLcdView("play");
                      }}
                      className={`flex min-h-12 flex-col items-center justify-center rounded-full px-3 leading-tight ${
                        exportMode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-[11px] opacity-80">{sub}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stompMode
                    ? "Each switch turns one effect on or off, like a pedalboard. The file opens this way."
                    : "Each switch calls up one part of the song. The file opens this way."}
                </p>
              </div>

              {!stompMode && preset.snapshots.length ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Song parts</h3>
                  <div
                    role="group"
                    aria-label="Song part to show"
                    className={`grid gap-2 ${preset.snapshots.length > 4 ? "grid-cols-2 sm:grid-cols-4" : preset.snapshots.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
                  >
                    {preset.snapshots.map((s, i) => {
                      const on = i === activeSnapshot;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickPart(i)}
                          className={`flex min-h-14 min-w-0 flex-col items-start justify-center gap-1 rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                            on ? "bg-secondary" : "border-border bg-background hover:bg-secondary/60"
                          }`}
                          style={on ? { borderColor: s.color } : undefined}
                        >
                          <span
                            className="rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-black"
                            style={{ background: s.color }}
                          >
                            {fs(snapFs[i]) || `Part ${i + 1}`}
                          </span>
                          <span className="w-full truncate text-base font-semibold">{s.name || `Snapshot ${i + 1}`}</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeSnap?.notes ? (
                    <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{activeSnap.name}: </span>
                      {activeSnap.notes}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {stompMode ? (
                readOnly ? null : (
                  <FsAssignPanel preset={preset} onAssign={assignFs} onReset={original ? resetFeatured : undefined} />
                )
              ) : null}

              <div className="space-y-2" data-tour="chain">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">Signal chain</h3>
                  <span className="text-xs text-muted-foreground">
                    {stompMode ? "How it starts when you load it" : `On in ${activeSnap?.name || "this part"}`} · tap a block for its knobs
                  </span>
                </div>
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-label="Signal chain, input to output">
                  {chain.map((b, i) => {
                    const model = blockModel(b)!;
                    const cat = CATEGORY_MAP[model.category];
                    const selected = b.id === selectedId;
                    const onFs = stompMode ? stompFsFor(b.id) : undefined;
                    return (
                      <li key={b.id} className="min-w-0">
                        <button
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${i + 1}. ${model.name}, based on ${model.basedOn}, ${b.enabled ? "on" : "off"}${onFs ? `, on FS${onFs}` : ""}. Show knobs.`}
                          onClick={() => selectBlock(b.id)}
                          className={`relative flex h-full min-h-[4.5rem] w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-xl border-2 py-2 pl-4 pr-2.5 text-left transition-colors ${
                            selected ? "border-foreground" : "border-transparent"
                          } ${b.enabled ? "" : "opacity-55"}`}
                          style={{
                            background: b.enabled
                              ? `color-mix(in oklab, ${cat.lcd} 18%, var(--color-background))`
                              : "var(--color-secondary)",
                          }}
                        >
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-1.5"
                            style={{ background: b.enabled ? cat.lcd : "transparent", borderRight: b.enabled ? undefined : `2px dashed ${cat.lcd}` }}
                          />
                          <span className="flex w-full items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                            <span style={{ color: cat.lcd }}>
                              {i + 1} · {cat.short}{onFs ? ` · FS${onFs}` : ""}
                            </span>
                            <span className={b.enabled ? "text-foreground" : "text-muted-foreground"}>{b.enabled ? "On" : "Off"}</span>
                          </span>
                          <span className="text-sm font-semibold leading-snug">{model.name}</span>
                          <span className="truncate text-xs leading-snug text-muted-foreground">{model.basedOn}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {selectedBlock ? (
                <BlockKnobs
                  key={selectedBlock.id}
                  block={selectedBlock}
                  partName={stompMode ? undefined : activeSnap?.name}
                  readOnly={readOnly}
                  onToggle={() => toggleBlock(selectedBlock.id)}
                  onChange={(name, value) => changeParam(selectedBlock.id, name, value)}
                />
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card" data-tour="replica" data-tutorial="replica">
              <button
                type="button"
                data-replica-toggle
                aria-expanded={showReplica}
                aria-controls="replica-panel"
                onClick={() => setShowReplica((open) => !open)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left sm:px-5"
              >
                <span>
                  <span className="block font-display text-base font-semibold">See it on your {device.name}</span>
                  <span className="block text-xs text-muted-foreground">The switches, screen and knobs as they look on the unit.</span>
                </span>
                <ChevronDown className={`size-5 shrink-0 transition-transform ${showReplica ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {showReplica ? (
                <div id="replica-panel" className="hx-replica-fit min-w-0 px-2 pb-2 sm:px-4">
                  <StompUnit
                    preset={displayed}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={selectBlock}
                    view={lcdView}
                    fsMode={fsMode}
                    paramPage={paramPage}
                    activeSnapshot={activeSnapshot}
                    assignFsIndex={assignFsIndex}
                    showDsp={showDsp}
                    onParamPage={setParamPage}
                    onView={setLcdView}
                    onFsMode={setFsMode}
                    onSnapshot={setActiveSnapshot}
                    onChangeParam={changeParam}
                    onToggleBlock={toggleBlock}
                    onAssignFsIndex={setAssignFsIndex}
                  />
                </div>
              ) : null}
            </section>
          </div>

          <div className="min-w-0 space-y-3">
            <Fold
              title={`Build it on the ${device.name}`}
              summary={`Import with ${editor}, then put it in ${EXPORT_MODE_LABEL[exportMode]} mode.`}
            >
              <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono text-[11px] text-foreground/70">1.</span>
                  <span>
                    Connect the {device.name} to a computer with USB. Open {editor}, then File → Import the .{exportExt}.{" "}
                    {isPodGo ? "Update POD Go Edit and the unit first." : "Use firmware 3.80 or newer."}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-[11px] text-foreground/70">2.</span>
                  <span>
                    {modeSteps} The numbered switches only recall the song parts in Snapshot mode.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-[11px] text-foreground/70">3.</span>
                  <span>Switch numbers match {editor}. FS1 is the top-left switch.</span>
                </li>
                {preset.programming.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-[11px] text-foreground/70">{i + 4}.</span>
                    <span>{noteText(step)}</span>
                  </li>
                ))}
              </ol>
              {canDownload && canExportHlx(preset.stompModel) ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={showAdvanced}
                    onClick={() => setShowAdvanced((open) => !open)}
                    className="min-h-11 text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Download blocked?
                  </button>
                  {showAdvanced ? (
                    <Button type="button" variant="secondary" className="h-11" onClick={() => void onCopy()} disabled={copying}>
                      {copying ? "Copying" : "Copy the file as text"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Stuck?{" "}
                <Link to="/guide" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2">
                  Open the guide
                </Link>
              </p>
            </Fold>

            {preset.snapshots.length && !stompMode && !readOnly ? (
              <Fold
                title="Switch names"
                summary={preset.snapshots.map((s) => s.name || "—").join(" · ")}
              >
                <p className="mb-2 text-xs text-muted-foreground">These names show on the unit. Up to 12 letters.</p>
                <div className="space-y-2">
                  {preset.snapshots.map((s, i) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <span
                        className="grid h-6 min-w-10 place-items-center rounded-full px-1.5 font-mono text-[11px] font-semibold text-black"
                        style={{ background: s.color }}
                      >
                        {fs(snapFs[i]) || i + 1}
                      </span>
                      <input
                        value={s.name}
                        maxLength={12}
                        aria-label={`Snapshot ${i + 1} name`}
                        onChange={(e) => renameSnapshot(s.id, e.target.value)}
                        onFocus={() => pickPart(i)}
                        className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-base font-medium"
                      />
                    </label>
                  ))}
                </div>
              </Fold>
            ) : null}

            {otherTips.length || tuning ? (
              <Fold title="Playing notes" summary={tuning ?? otherTips[0]}>
                <div className="space-y-2">
                  {preset.tips.map((t) => (
                    <p key={t} className="text-sm leading-relaxed text-muted-foreground">
                      {noteText(t)}
                    </p>
                  ))}
                </div>
              </Fold>
            ) : null}

            {preset.originalGear.length ? (
              <Fold title="Original rig" summary={preset.originalGear.map((g) => g.name).join(", ")}>
                <p className="mb-2 text-xs text-muted-foreground">What was used on the record or live.</p>
                <div className="space-y-3">
                  {preset.originalGear.map((g) => (
                    <div key={`${g.role}-${g.name}`}>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.role}</div>
                      <div className="text-sm font-medium">{g.name}</div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{g.notes}</p>
                    </div>
                  ))}
                </div>
              </Fold>
            ) : null}

            {preset.recommendedGear.length ? (
              <Fold title="Grab this" summary={preset.recommendedGear.map((g) => g.item).join(", ")}>
                <p className="mb-2 text-xs text-muted-foreground">Gear that gets you closer. Yours first.</p>
                <div className="space-y-2">
                  {preset.recommendedGear.map((g) => (
                    <div key={g.item} className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {g.fromLocker ? <Badge variant="outline">Your locker</Badge> : null}
                        {g.kind ? (
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.kind}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm font-medium">{g.item}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{g.why}</p>
                    </div>
                  ))}
                </div>
              </Fold>
            ) : null}

            {readOnly ? null : (
              <Fold
                title="Wah"
                summary={
                  wahMode === "exp"
                    ? "Helix wah on the expression pedal."
                    : wahMode === "fs"
                      ? "Helix wah on a footswitch."
                      : "Your own wah pedal, in front of the unit."
                }
              >
                <WahSelect mode={wahMode} modelId={wahModelId} onMode={onWahMode} onModel={onWahModel} />
              </Fold>
            )}

            {plan.signedIn && !readOnly ? (
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div>
                  <h2 className="font-display text-base font-semibold">Revise this tone</h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {plan.canResearch
                      ? "Played it and something's off? Tap what's wrong. It rebuilds the tone and uses one custom build."
                      : plan.paid
                        ? "You've used this month's custom builds. Revising is back next month."
                        : "Revising uses a custom build, and your free builds are used."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {plan.canResearch ? (
                    ["Too dark", "Too bright", "More gain", "Less gain", "Wrong amp"].map((note) => (
                      <button
                        key={note}
                        type="button"
                        disabled={Boolean(revising)}
                        onClick={() => void onRevise(note)}
                        className="h-11 rounded-full bg-secondary px-4 text-sm disabled:opacity-60"
                      >
                        {revising === note ? "Revising…" : note}
                      </button>
                    ))
                  ) : !plan.paid ? (
                    <Button asChild className="h-11">
                      <Link to="/upgrade">Subscribe to revise</Link>
                    </Button>
                  ) : null}
                  {beforeRevise ? (
                    <button
                      type="button"
                      onClick={() => undoRevise()}
                      className="h-11 rounded-full border border-border px-4 text-sm"
                    >
                      Undo last revise
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {readOnly ? null : (
              <section id="preset-feedback" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-semibold">After you test it</h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Tell us what you changed on the unit. It makes the next presets closer to the record.
                  </p>
                </div>
                <Button type="button" variant="secondary" className="h-11" onClick={() => setAskOpen("rate")}>
                  Rate this preset
                </Button>
              </section>
            )}
            <RigDisclaimer />
          </div>
        </div>
      </div>
      {canExportHlx(preset.stompModel) ? (
        <DownloadBar
          unitName={device.name}
          ext={exportExt}
          mode={exportMode}
          onMode={setExportMode}
          canDownload={canDownload}
          signInNext={signInToDownload}
          onDownload={onDownload}
        />
      ) : null}
      <PostDownloadDialog
        open={askOpen !== null}
        preset={preset}
        filename={savedFile}
        editor={editor}
        unitName={device.name}
        modeLabel={EXPORT_MODE_LABEL[exportMode]}
        fsMode={exportMode}
        getJson={() => hlxJson(preset, { fsMode: exportMode })}
        showImport={askOpen === "download"}
        onClose={() => setAskOpen(null)}
      />
    </>
  );
}

/** A reference section that stays closed until the player wants it: title and one line of what's inside. */
function Fold({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold">{title}</span>
          {summary ? <span className="block truncate text-xs text-muted-foreground">{summary}</span> : null}
        </span>
        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/**
 * Every knob of the selected block, big enough to read on a phone.
 * A tap on a slider's track does not move it (a tap must never wipe a tuned knob); drag it, or use the arrow keys.
 */
function BlockKnobs({
  block,
  partName,
  readOnly,
  onToggle,
  onChange,
}: {
  block: StompBlock;
  partName?: string;
  readOnly: boolean;
  onToggle: () => void;
  onChange: (name: string, value: number) => void;
}) {
  const model = blockModel(block);
  const press = useRef<{ x: number; moved: boolean } | null>(null);
  if (!model) return null;
  const cat = CATEGORY_MAP[model.category];
  const locked = isAmpOrCab(block.modelId);
  const knobs = paramEntries(block);
  return (
    <div role="group" className="space-y-4 rounded-xl border border-border bg-background p-3 sm:p-4" aria-labelledby={`knobs-${block.id}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 size-3 shrink-0 rounded-full" style={{ background: cat.lcd }} />
        <div className="min-w-0 flex-1">
          <p id={`knobs-${block.id}`} className="text-base font-semibold leading-snug">
            {model.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Based on {model.basedOn}
            {partName ? ` · knobs for ${partName}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={block.enabled}
          aria-label={`${block.enabled ? "Turn off" : "Turn on"} ${model.name}${partName ? ` in ${partName}` : ""}`}
          disabled={readOnly}
          onClick={onToggle}
          className={`h-11 min-w-16 shrink-0 rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-70 ${
            block.enabled ? "border-foreground bg-foreground text-background" : "border-border"
          }`}
        >
          {locked && block.enabled ? "Stays on" : block.enabled ? "On" : "Off"}
        </button>
      </div>
      {knobs.length ? (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {knobs.map((p) => (
            <div key={p.name} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-muted-foreground" id={`${block.id}-${p.name}`}>
                  {p.label}
                </span>
                <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">
                  {p.kind === "choice" && !p.options ? "" : p.kind === "switch" ? "" : p.display}
                </span>
              </div>
              {p.kind === "switch" ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.value >= 5}
                  aria-label={`${model.name} ${p.label}`}
                  disabled={readOnly}
                  onClick={() => onChange(p.name, p.value >= 5 ? 0 : 10)}
                  className={`mt-1 h-11 w-full rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.12em] ${
                    p.value >= 5 ? "border-foreground bg-foreground text-background" : "border-border"
                  }`}
                >
                  {p.value >= 5 ? "On" : "Off"}
                </button>
              ) : p.kind === "choice" ? (
                <select
                  value={p.value}
                  aria-label={`${model.name} ${p.label}`}
                  disabled={readOnly}
                  onChange={(e) => onChange(p.name, Number(e.target.value))}
                  className="mt-1 h-11 w-full rounded-md border border-border bg-background px-2 text-base"
                >
                  {Array.from({ length: p.max - p.min + 1 }, (_, i) => p.min + i).map((v) => (
                    <option key={v} value={v}>
                      {p.options?.[v - p.min] ?? v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.1}
                  value={Number.isFinite(p.value) ? p.value : 5}
                  aria-label={`${model.name} ${p.label}`}
                  aria-valuetext={p.display}
                  disabled={readOnly}
                  onPointerDown={(e) => (press.current = { x: e.clientX, moved: false })}
                  onPointerMove={(e) => {
                    if (press.current && Math.abs(e.clientX - press.current.x) > 4) press.current.moved = true;
                  }}
                  onPointerUp={() => (press.current = null)}
                  onPointerCancel={() => (press.current = null)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    // A tap on the track jumps the value; that is not a turn. A drag from the thumb moves in small steps.
                    if (press.current && !press.current.moved) {
                      if (Math.abs(next - p.value) > 0.6) return;
                      press.current.moved = true;
                    }
                    onChange(p.name, next);
                  }}
                  className="mt-1 h-11 w-full cursor-pointer accent-foreground"
                  style={{ accentColor: cat.lcd }}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This block has no knobs to set.</p>
      )}
    </div>
  );
}
