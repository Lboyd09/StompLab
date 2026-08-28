import { CATEGORY_MAP } from "@/data/categories";
import type { Preset } from "@/data/types";
import { copyHlx, downloadHlx, hlxFilename } from "@/lib/hlx";
import { blockModel, deviceFor, dspLoad, formatParam, sortedBlocks, withSnapshot } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StompUnit } from "../stomp/stomp-unit";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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
  const [copying, setCopying] = useState(false);
  const device = deviceFor(preset);
  const load = dspLoad(preset);
  const displayed = withSnapshot(preset, activeSnapshot);

  useEffect(() => {
    const snaps = preset.footswitches.filter((f) => f.action === "snapshot").length;
    const stomps = preset.footswitches.filter((f) => f.action === "bypass").length;
    setFsMode(snaps > 0 && snaps >= stomps ? "snapshot" : "stomp");
    setActiveSnapshot(0);
    setLcdView("play");
    // Intentionally keyed on preset.id so knob edits don't reset the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, preset.stompModel, setFsMode, setActiveSnapshot, setLcdView]);

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
    if (snap) {
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

  function onDownload() {
    const ok = downloadHlx(preset);
    toast.success(
      ok
        ? `Saved ${hlxFilename(preset)}. In HX Edit: File → Import, then PAGE to Snapshot mode.`
        : "Download was blocked. Use Copy .hlx JSON and save it as a .hlx file.",
    );
  }

  async function onCopy() {
    setCopying(true);
    try {
      await copyHlx(preset);
      toast.success("HX Edit JSON copied. Paste into a text file named .hlx and import it.");
    } catch {
      toast.error("Could not copy. Try Download .hlx instead.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>{preset.instrument}</span>
            <span>·</span>
            <span>{device.name}</span>
            <span>·</span>
            <span className="tabular-nums">{preset.tempo} BPM</span>
            <span>·</span>
            <span className="tabular-nums">{load}% DSP</span>
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
                HX Edit · File · Import · then Snapshot mode
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{preset.summary}</p>
        </header>

        <StompUnit
          preset={displayed}
          selectedBlockId={selectedBlockId}
          onSelectBlock={selectBlock}
          view={lcdView}
          fsMode={fsMode}
          paramPage={paramPage}
          activeSnapshot={activeSnapshot}
          onParamPage={setParamPage}
          onView={setLcdView}
          onFsMode={setFsMode}
          onSnapshot={setActiveSnapshot}
          onChangeParam={changeParam}
          onToggleBlock={toggleBlock}
        />

        <Card>
          <CardHeader>
            <CardTitle>Signal path</CardTitle>
            <CardDescription>Tap a block on the Stomp screen or here. Knobs edit the selected block.</CardDescription>
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
                {preset.snapshots.length} sections · tap to hear the change on the Stomp above
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
            <CardTitle>Footswitches</CardTitle>
            <CardDescription>
              {device.footswitches} switches · {device.snapshots} snapshots · {device.looper} looper
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {preset.footswitches.map((f) => (
              <div key={f.index} className="flex gap-3">
                <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                <div>
                  <div className="text-sm font-medium">
                    FS{f.index} · {f.label}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.action}
                    {f.notes ? ` — ${f.notes}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build it on the Stomp</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              {preset.programming.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-[10px] text-foreground/70">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
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
