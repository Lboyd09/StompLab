import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset } from "@/data/types";
import { copyHlx, downloadHlx, hlxFilename, canExportHlx } from "@/lib/hlx";
import {
  blockModel,
  canDownloadPreset,
  deviceFor,
  dspLoad,
  featuredOriginal,
  formatParam,
  isDemoId,
  isFeaturedKnownId,
  sortedBlocks,
  withSnapshot,
  withStompModel,
} from "@/lib/preset-utils";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StompUnit } from "../stomp/stomp-unit";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FsAssignPanel } from "./fs-assign";
import { FeedbackCard } from "../layout/feedback-card";
import { GearShopLinks, AffiliateNote } from "../layout/gear-shop-links";
import { PresetFeedbackDialog, PresetFeedbackForm } from "../layout/preset-feedback";
import { RigDisclaimer } from "../layout/disclaimer";
import { revisePresetFn } from "@/lib/research";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";

export function PresetWorkspace({
  preset,
  onChange,
}: {
  preset: Preset;
  onChange: (next: Preset) => void;
}) {
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
  const { plan, isPending: planPending } = usePlan();
  const [copying, setCopying] = useState(false);
  const [revising, setRevising] = useState<string | null>(null);
  const [askFeedback, setAskFeedback] = useState(false);
  const device = deviceFor(preset);
  const load = dspLoad(preset);
  const displayed = withSnapshot(preset, activeSnapshot);
  const exportMode = fsMode === "preset" ? "stomp" : fsMode;
  const original = featuredOriginal(preset.id);
  const canDownload = planPending
    ? isDemoId(preset.id) || !isFeaturedKnownId(preset.id)
    : canDownloadPreset(preset.id, plan);

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
    setAssignFsIndex(device.layout === "xl" ? 4 : 1);
    // Intentionally keyed on preset.id so knob edits don't reset the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, preset.stompModel, defaultFsMode, setFsMode, setActiveSnapshot, setLcdView, setAssignFsIndex]);

  function changeParam(blockId: string, name: string, value: number) {
    const snap = preset.snapshots[activeSnapshot];
    const hasOverride = Boolean(snap?.paramOverrides?.[blockId] && name in (snap.paramOverrides[blockId] ?? {}));
    if (hasOverride && snap) {
      onChange({
        ...preset,
        snapshots: preset.snapshots.map((s, i) =>
          i === activeSnapshot
            ? {
                ...s,
                paramOverrides: {
                  ...s.paramOverrides,
                  [blockId]: { ...s.paramOverrides![blockId], [name]: value },
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
    const snap = preset.snapshots[activeSnapshot];
    if (snap && fsMode === "snapshot") {
      const on = snap.enabledBlocks.includes(blockId);
      const enabledBlocks = on
        ? snap.enabledBlocks.filter((id) => id !== blockId)
        : [...snap.enabledBlocks, blockId];
      onChange({
        ...preset,
        snapshots: preset.snapshots.map((s, i) => (i === activeSnapshot ? { ...s, enabledBlocks } : s)),
      });
      return;
    }
    onChange({
      ...preset,
      blocks: preset.blocks.map((b) => (b.id === blockId ? { ...b, enabled: !b.enabled } : b)),
    });
  }

  function assignFs(index: number, patch: Partial<FootswitchAssign> | null) {
    const rest = preset.footswitches.filter((f) => f.index !== index);
    if (!patch) {
      onChange({ ...preset, footswitches: rest });
      return;
    }
    const existing = preset.footswitches.find((f) => f.index === index);
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
      setAskFeedback(true);
      return;
    }
    const filename = hlxFilename(preset);
    const editor = preset.stompModel === "pod-go" ? "POD Go Edit" : "HX Edit";
    if (confirmDownload && !window.confirm(`Download ${filename} for ${editor}?`)) return;
    const ok = downloadHlx(preset, { fsMode: exportMode });
    toast.success(
      ok
        ? `Saved ${filename}. In ${editor}: File → Import. The unit opens in ${exportMode === "snapshot" ? "Snapshot" : "Stomp"} mode.`
        : `Download was blocked. Use Copy JSON and save it as a ${filename.endsWith(".pgp") ? ".pgp" : ".hlx"} file.`,
    );
    if (ok) setAskFeedback(true);
  }

  async function onRevise(note: string) {
    if (!plan.signedIn) return;
    if (!plan.canResearch) return;
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
      notifyResearchSource(result.source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revise.");
    } finally {
      setRevising(null);
    }
  }

  async function onCopy() {
    if (!canDownload) return;
    setCopying(true);
    try {
      await copyHlx(preset, { fsMode: exportMode });
      toast.success("HX Edit JSON copied. Paste into a text file named .hlx and import it.");
    } catch {
      toast.error("Could not copy. Try Download .hlx instead.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
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
            <div className="flex flex-col items-end gap-1">
              {canDownload ? (
                <>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" onClick={onDownload} data-tour="download">
                      {canExportHlx(preset.stompModel)
                        ? `Download .${preset.stompModel === "pod-go" ? "pgp" : "hlx"}`
                        : "Export unavailable"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void onCopy()} disabled={copying}>
                      {copying ? "Copying" : "Copy JSON"}
                    </Button>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {preset.stompModel === "pod-go" ? "POD Go Edit" : "HX Edit"} · File · Import ·{" "}
                    {exportMode === "snapshot" ? "Snapshot" : "Stomp"} mode
                  </p>
                </>
              ) : (
                <>
                  <Button asChild>
                    <Link to="/upgrade">Unlock .hlx download</Link>
                  </Button>
                  <p className="max-w-[16rem] text-right text-[10px] leading-relaxed text-muted-foreground">
                    {isDemoId(preset.id)
                      ? "Demo download should be open — refresh if this is stuck."
                      : "Look at the replica for free. This known rig downloads after unlock. Demos still download."}
                  </p>
                </>
              )}
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{preset.summary}</p>
          {!canExportHlx(preset.stompModel) ? (
            <p className="text-sm text-muted-foreground">
              {device.name} does not export a preset file. The chain below is the map — copy it by hand.
            </p>
          ) : preset.stompModel === "pod-go" ? (
            <p className="text-sm text-muted-foreground">
              POD Go Edit imports .pgp JSON. File → Import. Helix .hlx will not load on this unit.
            </p>
          ) : null}
          <RigDisclaimer />
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-secondary p-1">
            {(
              [
                ["snapshot", "Snapshot"],
                ["stomp", "Stomp"],
                ["preset", "Preset"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFsMode(id);
                  if (id !== "stomp") setLcdView("play");
                }}
                className={`h-9 rounded-full px-3.5 text-xs font-medium ${
                  fsMode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {fsMode === "snapshot"
            ? canDownload
              ? "Snapshot — tap a numbered switch, then tap a song section. Numbers match HX Edit. Download writes this onto the unit."
              : "Snapshot — tap a numbered switch, then tap a song section. Numbers match HX Edit. Unlock to write this onto the unit."
            : fsMode === "stomp"
              ? canDownload
                ? "Stomp — tap a numbered switch, then tap an effect. Numbers match HX Edit. Download writes this onto the unit."
                : "Stomp — tap a numbered switch, then tap an effect. Numbers match HX Edit. Unlock to write this onto the unit."
              : "Preset — bank walking, the way the hardware sits when you aren't inside a song."}
        </p>

        <div data-tour="replica">
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

        <FsAssignPanel
          preset={preset}
          fsIndex={assignFsIndex}
          fsMode={fsMode}
          onAssign={assignFs}
          onReset={original ? resetFeatured : undefined}
        />

        <Card>
          <CardHeader>
            <CardTitle>Signal path</CardTitle>
            <CardDescription>Tap a block on the screen or here. The three knobs edit the selected block.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedBlocks(displayed).map((b, i) => {
              const model = blockModel(b);
              if (!model) return null;
              const cat = CATEGORY_MAP[model.category];
              const selected = (selectedBlockId ?? preset.blocks[0]?.id) === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => selectBlock(b.id)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left ${
                    selected ? "bg-secondary" : "hover:bg-secondary/60"
                  } ${b.enabled ? "" : "opacity-50"}`}
                >
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: cat.lcd }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                      <span className="text-sm font-medium">{model.name}</span>
                      <Badge variant="outline">{cat.short}</Badge>
                      {!b.enabled ? <Badge variant="outline">off</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Based on {model.basedOn}</span>
                    <GearShopLinks name={model.name} basedOn={model.basedOn} compact />
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      {Object.entries(b.params)
                        .slice(0, 6)
                        .map(([k, v]) => `${k} ${formatParam(v)}`)
                        .join("  ·  ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5">
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
                <GearShopLinks name={g.name} source="user" compact />
              </div>
            ))}
            {preset.originalGear.length ? <AffiliateNote className="pt-1 text-[10px] leading-relaxed text-muted-foreground" /> : null}
          </CardContent>
        </Card>

        {preset.recommendedGear.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Use from your locker</CardTitle>
              <CardDescription>Which of your guitars, basses, or amps to grab.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preset.recommendedGear.map((g) => (
                <div key={g.item}>
                  <div className="text-sm font-medium">{g.item}</div>
                  <p className="text-xs text-muted-foreground">{g.why}</p>
                  <GearShopLinks name={g.item} source="user" compact />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {preset.snapshots.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Snapshots</CardTitle>
              <CardDescription>
                {preset.snapshots.length} sections · tap to hear the change on the Stomp
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
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveSnapshot(i);
                      setFsMode("snapshot");
                    }}
                    className={`flex w-full gap-3 rounded-lg px-3 py-2.5 text-left ${
                      on ? "bg-secondary" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        Snap {i + 1} · {s.name}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.notes}</p>
                      {onNames ? (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{onNames}</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Build it on the Stomp</CardTitle>
            <CardDescription>
              The replica is the map. 1 is top-left, 6 is bottom-right — same as the numbers on the switches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/70">1.</span>
                <span>
                  USB to a computer. Open HX Edit. File → Import the .hlx. Firmware 3.80 or newer. Do not
                  drag the file onto a setlist.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/70">2.</span>
                <span>
                  On the unit, press PAGE until the display says{" "}
                  {exportMode === "snapshot" ? "SNAP" : "STOMP"}. The file loads that mode; PAGE is how you
                  confirm it.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/70">3.</span>
                <span>
                  Numbers on this replica: 1 top-left through 6 bottom-right. On an XL the factory silkscreen is inverted — our file puts replica 1 on the TOP-LEFT of the unit (hardware FS4), so intro is not on the closest row. MODE and TAP sit next to the bottom row. Volume is on the right of a Stomp, on the rear of an XL.
                </span>
              </li>
              {preset.programming.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-[10px] text-foreground/70">{i + 4}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Stuck?{" "}
              <Link to="/guide" className="text-primary underline underline-offset-2">
                Open the guide
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        {plan.signedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Revise this tone</CardTitle>
              <CardDescription>Tell the Lab what is off. It rewrites the path.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {["Too dark", "Too bright", "More gain", "Less gain", "Wrong amp"].map((note) => (
                <button
                  key={note}
                  type="button"
                  disabled={Boolean(revising)}
                  onClick={() => void onRevise(note)}
                  className="h-9 rounded-full bg-secondary px-3 text-xs"
                >
                  {revising === note ? "Revising…" : note}
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>After you test it</CardTitle>
            <CardDescription>
              What you changed on the unit trains the next songs. We will not retune this one by hand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PresetFeedbackForm song={preset.song || preset.name} />
          </CardContent>
        </Card>

        <FeedbackCard />

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
      </aside>
    </div>
      <PresetFeedbackDialog
        song={preset.song || preset.name}
        open={askFeedback}
        onClose={() => setAskFeedback(false)}
      />
    </>
  );
}
