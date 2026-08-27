import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURED } from "@/data/featured";
import { listCachedSongs, lookupCache } from "@/lib/cache";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { overlayUserGear } from "@/lib/preset-schema";
import { newId } from "@/lib/preset-utils";
import { researchSong } from "@/lib/research";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/")({ component: Home });

function featuredKey(song: string, artist: string | undefined, instrument: string) {
  return `${song}|${artist ?? ""}|${instrument}`.toLowerCase();
}

function Home() {
  const navigate = useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const gear = useAppStore((s) => s.gear);
  const geminiKey = useAppStore((s) => s.geminiKey);
  const savePreset = useAppStore((s) => s.savePreset);
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<
    { song: string; artist: string; instrument: string; stompModel: string; hitCount: number; key: string }[]
  >([]);

  const featured = FEATURED.filter((p) => p.instrument === instrument);
  const featuredSet = new Set(
    FEATURED.map((p) => featuredKey(p.song ?? "", p.artist, p.instrument)),
  );

  useEffect(() => {
    listCachedSongs()
      .then(setLibrary)
      .catch(() => undefined);
  }, []);

  const community = library.filter(
    (row) =>
      row.instrument === instrument &&
      row.stompModel === stompModel &&
      !featuredSet.has(featuredKey(row.song, row.artist, row.instrument)),
  );

  async function onResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!song.trim()) return;
    setBusy(true);
    try {
      const result = await researchSong({
        song: song.trim(),
        artist: artist.trim() || undefined,
        instrument,
        stompModel,
        userGear: gear,
        apiKey: geminiKey,
      });
      if (!result.ok) {
        notifyResearchError(result, () => void navigate({ to: "/settings" }));
        return;
      }
      savePreset(result.preset);
      notifyResearchSource(result.source);
      await navigate({ to: "/preset/$id", params: { id: result.preset.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  function openFeatured(id: string) {
    const src = FEATURED.find((p) => p.id === id);
    if (!src) return;
    const preset = overlayUserGear(
      {
        ...src,
        id: `${src.id}-${stompModel}`,
        stompModel,
        createdAt: Date.now(),
        footswitches:
          stompModel === "hx-stomp"
            ? src.footswitches.filter((f) => f.index <= 3)
            : src.footswitches,
      },
      gear,
    );
    savePreset(preset);
    void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  async function openCached(key: string) {
    setBusy(true);
    try {
      const cached = await lookupCache({ data: { key } });
      if (!cached.hit || !cached.preset) {
        toast.error("That rig is no longer in the shared library.");
        return;
      }
      const preset = overlayUserGear(
        { ...cached.preset, id: newId("pst"), createdAt: Date.now() },
        gear,
      );
      savePreset(preset);
      notifyResearchSource("cache");
      await navigate({ to: "/preset/$id", params: { id: preset.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open that rig");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">HX Stomp laboratory</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Research a song. Copy the preset onto your Stomp.
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Name a track. Stomp Lab maps the real amps, pedals, and cabs to HX models, then lays them
          out on an interactive Stomp — knobs, footswitches, snapshots, and the build order. No Grok
          credits. Repeats are free for everyone.
        </p>
      </section>

      <form onSubmit={onResearch} className="max-w-2xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="song">Song</Label>
            <Input
              id="song"
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="Enter Sandman"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="artist">Artist</Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Metallica"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Researching" : "Build preset"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Using {instrument} · {stompModel === "hx-stomp" ? "HX Stomp (3 switches)" : "HX Stomp XL (8 switches)"}.
          Change both in the header.
        </p>
        <GeminiHint />
      </form>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">Start with a known rig</h2>
          <span className="text-xs text-muted-foreground">{instrument} · no key needed</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openFeatured(p.id)}
              className="group rounded-xl border border-border bg-card p-5 text-left shadow-[var(--shadow-border)] hover:border-primary/40"
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {p.artist}
              </div>
              <div className="mt-1 font-display text-lg font-semibold">{p.song}</div>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>
              <div className="mt-4 flex items-center gap-1 text-xs text-foreground">
                Open on Stomp
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {community.length ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-lg font-semibold">Shared library</h2>
            <span className="text-xs text-muted-foreground">Researched once, kept for everyone</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {community.map((row) => (
              <button
                key={row.key}
                type="button"
                disabled={busy}
                onClick={() => void openCached(row.key)}
                className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {row.artist || "Unknown artist"}
                </div>
                <div className="mt-1 font-display text-lg font-semibold">{row.song}</div>
                <p className="mt-2 text-xs text-muted-foreground">Opened {row.hitCount} times</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How to copy it</CardTitle>
          <CardDescription>The screen is the unit. Match blocks left to right, then assign the footswitches.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
          <p>
            <span className="block font-medium text-foreground">1. Path</span>
            Add each block in order. Amp and cab are two blocks. Stay at 8 or under.
          </p>
          <p>
            <span className="block font-medium text-foreground">2. Knobs</span>
            Select a block, then set the three knobs. PAGE for more parameters. Values are 0–10.
          </p>
          <p>
            <span className="block font-medium text-foreground">3. Switches</span>
            PAGE cycles Stomp / Snapshot / Preset. Command Center assigns bypass, snapshots, tap, and tuner.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
