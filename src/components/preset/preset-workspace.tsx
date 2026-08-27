import { CATEGORY_MAP } from "@/data/categories";
import type { Preset } from "@/data/types";
import { blockModel, deviceFor, dspLoad, formatParam, sortedBlocks } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import { StompUnit } from "../stomp/stomp-unit";
import { Badge } from "../ui/badge";
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
  const device = deviceFor(preset);
  const load = dspLoad(preset);

  function changeParam(blockId: string, name: string, value: number) {
    onChange({
      ...preset,
      blocks: preset.blocks.map((b) =>
        b.id === blockId ? { ...b, params: { ...b.params, [name]: value } } : b,
      ),
    });
  }

  function toggleBlock(blockId: string) {
    onChange({
      ...preset,
      blocks: preset.blocks.map((b) => (b.id === blockId ? { ...b, enabled: !b.enabled } : b)),
    });
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
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{preset.summary}</p>
        </header>

        <StompUnit
          preset={preset}
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
            {sortedBlocks(preset).map((b, i) => {
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
                <span
                  className="mt-1 size-2.5 shrink-0 rounded-full"
                  style={{ background: f.color }}
                />
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
