import { CATEGORY_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset } from "@/data/types";
import { copyHlx, downloadHlx, hlxFilename } from "@/lib/hlx";
import { blockModel, deviceFor, dspLoad, formatParam, sortedBlocks, withSnapshot } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StompUnit } from "../stomp/stomp-unit";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FsAssignPanel } from "./fs-assign";

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
  const showFsNumbers = useAppStore((s) => s.showFsNumbers);
  const confirmDownload = useAppStore((s) => s.confirmDownload);
  const [copying, setCopying] = useState(false);
  const device = deviceFor(preset);
  const load = dspLoad(preset);
  const displayed = withSnapshot(preset, activeSnapshot);
  const exportMode = fsMode === "preset" ? "stomp" : fsMode;

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

  function fillStompDefaults() {
    const fx = sortedBlocks(preset);
    const slots = device.footswitches === 8 ? 6 : 3;
    const assigns: FootswitchAssign[] = fx.slice(0, slots).map((b, i) => {
      const model = blockModel(b);
      return {
        index: i + 1,
        label: model?.abbrev ?? `FS${i + 1}`,
        color: model ? CATEGORY_MAP[model.category].lcd : "#c5c9c2",
        action: "bypass",
        targetBlockId: b.id,
        notes: model ? `Toggle ${model.name}` : "",
      };
    });
    if (device.footswitches === 8) {
      assigns.push({
        index: 7,
        label: "MODE",
        color: "#5a5e62",
        action: "mode",
        notes: "Cycle Stomp / Snapshot / Preset",
      });
      assigns.push({
        index: 8,
        label: "TAP",
        color: "#e24a3a",
        action: "tap",
        notes: "Tap tempo",
      });
    }
    onChange({ ...preset, footswitches: assigns, exportFsMode: "stomp" });
    setFsMode("stomp");
    setLcdView("assign");
    setAssignFsIndex(1);
    toast.success("Front row is now your effects. Tap a switch to change one.");
  }

  function fillSnapshotDefaults() {
    const slots = Math.min(preset.snapshots.length, device.footswitches === 8 ? 6 : 3);
    const assigns: FootswitchAssign[] = preset.snapshots.slice(0, slots).map((s, i) => ({
      index: i + 1,
      label: s.name.slice(0, 8).toUpperCase(),
      color: s.color,
      action: "snapshot" as const,
      snapshotId: s.id,
      notes: `Recall ${s.name}`,
    }));
    if (device.footswitches === 8) {
      assigns.push({
        index: 7,
        label: "MODE",
        color: "#5a5e62",
        action: "mode",
        notes: "Cycle Stomp / Snapshot / Preset",
      });
      assigns.push({
        index: 8,
        label: "TAP",
        color: "#e24a3a",
        action: "tap",
        notes: "Tap tempo",
      });
    }
    onChange({ ...preset, footswitches: assigns, exportFsMode: "snapshot" });
    setFsMode("snapshot");
    setLcdView("play");
    toast.success("Front row is verse / chorus / sections. Download writes Snapshot mode.");
  }

  function onDownload() {
    if (confirmDownload && !window.confirm(`Download ${hlxFilename(preset)} for HX Edit?`)) return;
    const ok = downloadHlx(preset, { fsMode: exportMode });
    toast.success(
      ok
        ? `Saved ${hlxFilename(preset)}. In HX Edit: File → Import. The unit opens in ${exportMode === "snapshot" ? "Snapshot" : "Stomp"} mode.`
        : "Download was blocked. Use Copy JSON and save it as a .hlx file.",
    );
  }

  async function onCopy() {
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
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" onClick={onDownload}>
                  Download .hlx
                </Button>
                <Button type="button" variant="secondary" onClick={() => void onCopy()} disabled={copying}>
                  {copying ? "Copying" : "Copy JSON"}
                </Button>
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                HX Edit · File · Import · {exportMode === "snapshot" ? "Snapshot" : "Stomp"} mode
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{preset.summary}</p>
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
          <Button
            type="button"
            size="sm"
            variant={lcdView === "assign" ? "default" : "outline"}
            onClick={() => setLcdView(lcdView === "assign" ? "play" : "assign")}
          >
            {lcdView === "assign" ? "Done" : "Set switches"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {fsMode === "snapshot"
            ? "Snapshot — each front switch is a song section. Download writes this mode onto the unit."
            : fsMode === "stomp"
              ? "Stomp — each switch turns an effect on or off. Download writes this mode onto the unit."
              : "Preset — bank walking, the way the hardware sits when you aren't inside a song."}
        </p>

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
          showFsNumbers={showFsNumbers}
          onParamPage={setParamPage}
          onView={setLcdView}
          onFsMode={setFsMode}
          onSnapshot={setActiveSnapshot}
          onChangeParam={changeParam}
          onToggleBlock={toggleBlock}
          onAssignFsIndex={(index) => {
            setAssignFsIndex(index);
            setLcdView("assign");
          }}
        />

        <FsAssignPanel
          preset={preset}
          fsIndex={assignFsIndex}
          onSelect={(index) => {
            setAssignFsIndex(index);
            setLcdView("assign");
          }}
          onAssign={assignFs}
          onAutoEffects={fillStompDefaults}
          onAutoSnapshots={fillSnapshotDefaults}
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
              </div>
            ))}
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
            <CardDescription>The replica is the map. Closest row to you is 1–3, same as the hardware.</CardDescription>
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
                  Front row (closest to your toes) is switches 1–3. On XL the back row is 4–6; MODE and TAP
                  sit to the right of the screen. Volume is on the right of a Stomp, on the rear of an XL.
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
  );
}
