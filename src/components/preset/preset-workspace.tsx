import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset } from "@/data/types";
import { copyHlx, downloadHlx, hlxFilename, hlxJson, canExportHlx } from "@/lib/hlx";
import {
  blockModel,
  canDownloadPreset,
  deviceFor,
  dspLoad,
  featuredOriginal,
  isDemoId,
  isEqToggleBlock,
  isFeaturedKnownId,
  isGateBlock,
  paramEntries,
  sortedBlocks,
  withSnapshot,
  withStompModel,
} from "@/lib/preset-utils";
import { isAmpOrCab } from "@/lib/snapshot-sanitize";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { Link } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StompUnit } from "../stomp/stomp-unit";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FsAssignPanel, stompSwitchIndices } from "./fs-assign";
import { unitSpec } from "../stomp/hardware";
import { DownloadBar, EXPORT_MODE_LABEL, type ExportMode } from "./download-bar";
import { FREE_BUILD_LINE } from "@/lib/copy";
import { PostDownloadDialog, shouldAskAgain } from "../layout/post-download";
import { RigDisclaimer } from "../layout/disclaimer";
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

  return (
    <>
    <div className="space-y-8 pb-24">
      <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>{preset.instrument}</span>
            <span>·</span>
            <span>{device.name}</span>
            <span>·</span>
            <span className="tabular-nums">{preset.tempo} BPM</span>
            {showDsp ? (
              <>
                <span>·</span>
                <span className="tabular-nums">{load}% DSP</span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {preset.song ? (
                <>
                  {preset.song}
                  {preset.artist ? (
                    <span className="text-muted-foreground"> — {preset.artist}</span>
                  ) : null}
                </>
              ) : (
                preset.name
              )}
            </h1>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-sm sm:items-end">
              {canDownload && canExportHlx(preset.stompModel) && !readOnly ? (
                <Button type="button" className="h-11 w-full sm:w-auto" onClick={onDownload} data-tour="download">
                  Download .{exportExt}
                </Button>
              ) : null}
              {canDownload ? null : (
                <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground sm:text-right">
                  {signInToDownload
                    ? `Sign in to download. ${FREE_BUILD_LINE}`
                    : isDemoId(preset.id)
                      ? "We could not confirm your account. Reload the page and try again."
                      : "You can look around. Subscribe to download this one; the demos stay free."}
                </p>
              )}
              {canShare ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full sm:w-auto sm:self-end"
                  disabled={sharing}
                  onClick={() => void onShare()}
                >
                  <Share2 className="size-4" />
                  {sharing ? "Making link" : "Share this preset"}
                </Button>
              ) : null}
              {readOnly ? null : (
                <Button asChild variant="ghost" size="sm" className="h-11 w-full sm:w-auto sm:self-end">
                  <Link to="/setlist" search={{ add: preset.id }}>Add to setlist</Link>
                </Button>
              )}
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{preset.summary}</p>
          {!canExportHlx(preset.stompModel) ? (
            <p className="text-sm text-muted-foreground">
              {device.name} does not export a preset file. The chain below is the map — copy it by hand.
            </p>
          ) : isPodGo ? (
            <p className="text-sm text-muted-foreground">
              POD Go Edit imports .pgp JSON. File → Import. Helix .hlx will not load on this unit.
            </p>
          ) : null}
          <RigDisclaimer />
        </header>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="order-2 grid gap-4 md:grid-cols-2">
            {readOnly || !stompMode ? null : (
              <FsAssignPanel preset={preset} onAssign={assignFs} onReset={original ? resetFeatured : undefined} />
            )}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Signal path</CardTitle>
            <CardDescription>
              {stompMode
                ? "How the preset starts when you load it. Use Footswitches to turn effects on and off while you play."
                : "Pick a song part first. On and off, and every knob, apply to that part only."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {preset.snapshots.length && !stompMode ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Snapshot to edit">
                {preset.snapshots.map((s, i) => {
                  const on = i === activeSnapshot;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setActiveSnapshot(i);
                        setFsMode("snapshot");
                      }}
                      className={`min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-9 md:px-3 md:text-xs ${
                        on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                      }`}
                    >
                      {s.name || `Snap ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {(() => {
              const gateBlock = displayed.blocks.find((b) => isGateBlock(b.modelId));
              const eqBlock = displayed.blocks.find((b) => isEqToggleBlock(b.modelId));
              if (!gateBlock && !eqBlock) return null;
              return (
                <div className="flex flex-wrap gap-2">
                  {gateBlock ? (
                    <button
                      type="button"
                      onClick={() => toggleBlock(gateBlock.id)}
                      className={`min-h-11 rounded-full border px-4 text-xs uppercase tracking-[0.16em] md:min-h-8 md:px-3 ${
                        gateBlock.enabled
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      Gate {gateBlock.enabled ? "on" : "off"}
                    </button>
                  ) : null}
                  {eqBlock ? (
                    <button
                      type="button"
                      onClick={() => toggleBlock(eqBlock.id)}
                      className={`min-h-11 rounded-full border px-4 text-xs uppercase tracking-[0.16em] md:min-h-8 md:px-3 ${
                        eqBlock.enabled
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      EQ {eqBlock.enabled ? "on" : "off"}
                    </button>
                  ) : null}
                </div>
              );
            })()}
            {sortedBlocks(displayed).map((b, i) => {
              const model = blockModel(b);
              if (!model) return null;
              const cat = CATEGORY_MAP[model.category];
              const selected = (selectedBlockId ?? preset.blocks[0]?.id) === b.id;
              const locked = isAmpOrCab(b.modelId);
              return (
                <div
                  key={b.id}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 ${
                    selected ? "bg-secondary" : "hover:bg-secondary/60"
                  } ${b.enabled ? "" : "opacity-60"}`}
                >
                  <button
                    type="button"
                    onClick={() => selectBlock(b.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-start gap-3 py-1 text-left"
                  >
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: cat.lcd }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                        <span className="text-sm font-medium">{model.name}</span>
                        <Badge variant="outline">{cat.short}</Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Based on {model.basedOn}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={b.enabled}
                    aria-label={`${b.enabled ? "Turn off" : "Turn on"} ${model.name} on this snapshot`}
                    onClick={() => toggleBlock(b.id)}
                    className={`shrink-0 min-h-11 min-w-14 rounded-full border px-3 text-xs uppercase tracking-[0.14em] md:min-h-8 md:min-w-0 ${
                      b.enabled ? "border-foreground bg-foreground text-background" : "border-border"
                    }`}
                  >
                    {locked && b.enabled ? "Stays on" : b.enabled ? "On" : "Off"}
                  </button>
                </div>
              );
            })}
            {(() => {
              const selectedId = selectedBlockId ?? preset.blocks[0]?.id;
              const block = displayed.blocks.find((b) => b.id === selectedId);
              const model = block ? blockModel(block) : undefined;
              if (!block || !model) return null;
              const snapName = preset.snapshots[activeSnapshot]?.name;
              const knobs = paramEntries(block);
              return (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{model.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {snapName ? `${snapName} · every knob` : "Every knob"} · as HX Edit shows it
                    </p>
                  </div>
                  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {knobs.map((p) => (
                    <label key={p.name} className="grid grid-cols-[6rem_minmax(0,1fr)_4.2rem] items-center gap-2 text-xs">
                      <span className="truncate text-muted-foreground" title={p.label}>{p.label}</span>
                      {p.kind === "switch" ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.value >= 5}
                          aria-label={`${model.name} ${p.label}`}
                          onClick={() => changeParam(block.id, p.name, p.value >= 5 ? 0 : 10)}
                          className={`min-h-11 rounded-full border px-3 text-xs uppercase tracking-[0.14em] md:min-h-8 ${
                            p.value >= 5 ? "border-foreground bg-foreground text-background" : "border-border"
                          }`}
                        >
                          {p.value >= 5 ? "On" : "Off"}
                        </button>
                      ) : p.kind === "choice" ? (
                        <select
                          value={p.value}
                          aria-label={`${model.name} ${p.label}`}
                          onChange={(e) => changeParam(block.id, p.name, Number(e.target.value))}
                          className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-base md:min-h-8 md:text-xs"
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
                          onChange={(e) => changeParam(block.id, p.name, Number(e.target.value))}
                          className="w-full accent-foreground"
                        />
                      )}
                      <span className="truncate text-right font-mono tabular-nums">{p.kind === "choice" && !p.options ? "" : p.display}</span>
                    </label>
                  ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Original rig</CardTitle>
            <CardDescription>What was actually used on the record / live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {preset.originalGear.map((g) => (
              <div key={`${g.role}-${g.name}`}>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.role}</div>
                <div className="text-sm font-medium">{g.name}</div>
                <p className="text-xs text-muted-foreground">{g.notes}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {preset.recommendedGear.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Grab this</CardTitle>
              <CardDescription>
                Models to use for this song — locker pieces first, then the rest of the brief.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preset.recommendedGear.map((g) => (
                <div key={g.item} className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {g.fromLocker ? (
                      <Badge variant="outline">Your locker</Badge>
                    ) : null}
                    {g.kind ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.kind}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm font-medium">{g.item}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{g.why}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {preset.snapshots.length && !stompMode && !readOnly ? (
          <Card>
            <CardHeader>
              <CardTitle>Switch names</CardTitle>
              <CardDescription>
                These names show on the unit. Rename them before you download if you like.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {preset.snapshots.map((s, i) => {
                const on = i === activeSnapshot;
                const onNames = s.enabledBlocks
                  .map((id) => {
                    const block = preset.blocks.find((b) => b.id === id);
                    return block ? blockModel(block)?.abbrev : undefined;
                  })
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={s.id}
                    className={`flex w-full gap-3 rounded-lg px-3 py-2.5 ${
                      on ? "bg-secondary" : "hover:bg-secondary/60"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`Recall ${s.name}`}
                      onClick={() => {
                        setActiveSnapshot(i);
                        setFsMode("snapshot");
                      }}
                      className="-ml-2 -mt-1 grid size-11 shrink-0 place-items-center"
                    >
                      <span className="size-3 rounded-full" style={{ background: s.color }} />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">FS{snapFs[i] ?? i + 1}</span>
                        <input
                          value={s.name}
                          maxLength={12}
                          aria-label={`Snapshot ${i + 1} name`}
                          readOnly={readOnly}
                          onChange={(e) => renameSnapshot(s.id, e.target.value)}
                          onFocus={() => {
                            setActiveSnapshot(i);
                            setFsMode("snapshot");
                          }}
                          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-base font-medium md:h-8 md:text-sm"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{s.notes}</p>
                      {onNames ? (
                        <p className="font-mono text-[10px] text-muted-foreground">{onNames}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {readOnly ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Wah</CardTitle>
            <CardDescription>
              After you build — not on the Lab form. A real wah stays in front of the unit unless you pick Helix wah here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WahSelect mode={wahMode} modelId={wahModelId} onMode={onWahMode} onModel={onWahModel} />
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Build it on the {device.name}</CardTitle>
            <CardDescription>Import on a computer, then play.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/70">1.</span>
                <span>
                  Connect the {device.name} to a computer with USB. Open {editor}, then File → Import the .{exportExt}.{" "}
                  {isPodGo ? "Update POD Go Edit and the unit first." : "Use firmware 3.80 or newer."}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/70">2.</span>
                <span>
                  Put the {device.name} in {EXPORT_MODE_LABEL[exportMode]} mode
                  {isPodGo ? "." : <> (press PAGE until the display says {exportMode === "snapshot" ? "SNAP" : "STOMP"}).</>}{" "}
                  The numbered switches only recall the tones in Snapshot mode.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/70">3.</span>
                <span>Switch 1 is top-left, the same numbers as the replica above.</span>
              </li>
              {preset.programming.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-[10px] text-foreground/70">{i + 4}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {canDownload && canExportHlx(preset.stompModel) ? (
              <div className="mt-3">
                <button
                  type="button"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced((open) => !open)}
                  className="min-h-11 text-xs text-muted-foreground underline underline-offset-2"
                >
                  Download blocked?
                </button>
                {showAdvanced ? (
                  <Button type="button" variant="secondary" className="ml-2 h-11" onClick={() => void onCopy()} disabled={copying}>
                    {copying ? "Copying" : "Copy the file as text"}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Stuck?{" "}
              <Link to="/guide" className="text-primary underline underline-offset-2">
                Open the guide
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        {plan.signedIn && !readOnly ? (
          <Card>
            <CardHeader>
              <CardTitle>Revise this tone</CardTitle>
              <CardDescription>
                {plan.canResearch
                  ? "Played it and something's off? Tap what's wrong. It rebuilds the tone and uses one custom build."
                  : plan.paid
                    ? "You've used this month's custom builds. Revising is back next month."
                    : "Revising uses a custom build, and your free builds are used."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.canResearch ? (
                ["Too dark", "Too bright", "More gain", "Less gain", "Wrong amp"].map((note) => (
                  <button
                    key={note}
                    type="button"
                    disabled={Boolean(revising)}
                    onClick={() => void onRevise(note)}
                    className="h-11 rounded-full bg-secondary px-4 text-sm disabled:opacity-60 md:h-9 md:px-3 md:text-xs"
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
                  className="h-11 rounded-full border border-border px-4 text-sm md:h-9 md:px-3 md:text-xs"
                >
                  Undo last revise
                </button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {readOnly ? null : (
        <Card>
          <CardHeader id="preset-feedback">
            <CardTitle>After you test it</CardTitle>
            <CardDescription>
              What you changed on the unit helps make the next presets closer to the record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="secondary" className="h-11" onClick={() => setAskOpen("rate")}>
              Rate this preset
            </Button>
          </CardContent>
        </Card>
        )}

        {preset.tips.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Playing notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {preset.tips.map((t) => (
                <p key={t} className="text-sm text-muted-foreground">
                  {t}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
          </div>

          <div className="hx-replica-fit order-1 min-w-0 space-y-4">
            <div className="space-y-1.5">
              <p id="fs-mode-label" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Footswitches
              </p>
              <div role="radiogroup" aria-labelledby="fs-mode-label" className="grid grid-cols-2 rounded-full bg-secondary p-1 sm:inline-grid">
                {(
                  [
                    ["snapshot", "Song parts (Snapshot)"],
                    ["stomp", "Effects (Stomp)"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={exportMode === id}
                    onClick={() => {
                      setExportMode(id);
                      setLcdView("play");
                    }}
                    className={`h-11 rounded-full px-3 text-xs font-medium sm:px-4 md:h-9 ${
                      exportMode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {stompMode
                  ? "Each switch turns one effect on or off, like a pedalboard. The file opens this way."
                  : "Each switch is one part of the song. The file opens this way."}
              </p>
            </div>
            <div data-tour="replica" data-tutorial="replica">
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
            {preset.snapshots.length && !stompMode ? (
              <section aria-labelledby="song-map" className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="song-map" className="text-sm font-semibold">Song map</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">{preset.tempo} BPM</span>
                </div>
                <ol className="space-y-1.5" role="group" aria-label="Recall a snapshot">
                  {preset.snapshots.map((s, i) => {
                    const on = i === activeSnapshot && fsMode === "snapshot";
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setActiveSnapshot(i);
                            setFsMode("snapshot");
                          }}
                          className={`flex min-h-11 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left ${
                            on ? "border-foreground bg-secondary" : "border-border bg-card"
                          }`}
                        >
                          <span
                            className="mt-0.5 grid h-6 min-w-9 shrink-0 place-items-center rounded-full px-1.5 font-mono text-[11px] font-semibold text-black"
                            style={{ background: s.color }}
                          >
                            FS{snapFs[i] ?? i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{s.name || `Snapshot ${i + 1}`}</span>
                            {s.notes ? (
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{s.notes}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}
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
