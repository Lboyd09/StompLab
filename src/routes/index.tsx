import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlaybackSelect } from "@/components/layout/playback-select";
import { RigDisclaimer } from "@/components/layout/disclaimer";
import { FeedbackCard } from "@/components/layout/feedback-card";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { ResearchProgress } from "@/components/layout/research-progress";
import { SongTypeahead } from "@/components/layout/song-typeahead";
import { UpgradeBanner } from "@/components/layout/upgrade-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVICE_MAP } from "@/data/categories";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { PlaybackTarget } from "@/data/types";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { overlayUserGear } from "@/lib/preset-schema";
import { isDemoId, withStompModel } from "@/lib/preset-utils";
import { matchFeatured, researchSongFn } from "@/lib/research";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { FREE_BUILDS } from "@/lib/plan";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" && s.q.length ? s.q : undefined,
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const search = Route.useSearch();
  const { plan, refresh, isPending: planPending } = usePlan();
  const [song, setSong] = useState(search.q ?? "");
  const [artist, setArtist] = useState("");
  const [playbackTarget, setPlaybackTarget] = useState<PlaybackTarget>("frfr");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const featured = FEATURED.filter((p) => p.instrument === instrument);
  const demos = featured.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));
  const rest = featured.filter((p) => !(DEMO_IDS as readonly string[]).includes(p.id));

  useEffect(() => {
    if (search.q) setSong(search.q);
  }, [search.q]);

  function openFeatured(id: string) {
    const src = FEATURED.find((p) => p.id === id);
    if (!src) return;
    if (!isDemoId(src.id) && !plan.paid) {
      void navigate({ to: "/upgrade" });
      return;
    }
    const preset = overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, stompModel), gear);
    savePreset(preset);
    void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  async function onResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!song.trim()) return;
    const featuredHit = matchFeatured(song.trim(), artist.trim() || undefined, instrument, stompModel);
    if (featuredHit) {
      const src = FEATURED.find(
        (p) => p.instrument === featuredHit.instrument && p.song === featuredHit.song,
      );
      if (src && isDemoId(src.id)) {
        savePreset(overlayUserGear(withStompModel(featuredHit, stompModel), gear));
        notifyResearchSource("library");
        await navigate({ to: "/preset/$id", params: { id: featuredHit.id } });
        return;
      }
      if (src && !plan.paid) {
        await navigate({ to: "/upgrade" });
        return;
      }
      if (src && plan.paid) {
        savePreset(overlayUserGear(withStompModel(featuredHit, stompModel), gear));
        notifyResearchSource("library");
        await navigate({ to: "/preset/$id", params: { id: featuredHit.id } });
        return;
      }
    }
    if (planPending) return;
    if (!plan.signedIn) {
      await navigate({ to: "/login", search: { next: "/" } });
      return;
    }
    if (!plan.canResearch) {
      await navigate({ to: "/upgrade" });
      return;
    }
    setBusy(true);
    setStatus("Researching…");
    setProgress(8);
    const tick = window.setInterval(() => {
      setProgress((p) => (p >= 94 ? 94 : p + 3));
    }, 450);
    try {
      const result = await researchSongFn({
        data: {
          song: song.trim(),
          artist: artist.trim() || undefined,
          instrument,
          stompModel,
          playbackTarget,
          userGear: gear,
        },
      });
      if (!result.ok) {
        if (result.reason === "paywall" || result.reason === "quota") {
          await navigate({ to: "/upgrade" });
          return;
        }
        if (result.reason === "signin") {
          await navigate({ to: "/login", search: { next: "/" } });
          return;
        }
        notifyResearchError(result, {
          login: () => void navigate({ to: "/login" }),
          upgrade: () => void navigate({ to: "/upgrade" }),
        });
        setStatus(result.error);
        return;
      }
      savePreset(result.preset);
      notifyResearchSource(result.source);
      await refresh();
      await navigate({ to: "/preset/$id", params: { id: result.preset.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Research failed";
      if (message === "Unauthorized") {
        await navigate({ to: "/login", search: { next: "/" } });
        return;
      }
      toast.error(message);
      setStatus(message);
    } finally {
      window.clearInterval(tick);
      setBusy(false);
      setProgress(0);
    }
  }

  const used = plan.signedIn && !plan.paid ? Math.min(FREE_BUILDS, plan.freeUsed) : 0;

  return (
    <div className="space-y-10">
      <UpgradeBanner plan={plan} pending={planPending} />

      <section className="max-w-2xl space-y-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">HX Stomp laboratory</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Type a song.
          <span className="block text-muted-foreground">Get a preset that sounds like the record.</span>
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Research the tracking rig. See it on the unit. Download a .hlx HX Edit can import. Three
          demos always work — no account required.
        </p>
        <RigDisclaimer />
      </section>

      {plan.signedIn && plan.paid ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {plan.monthUsed} / {plan.monthLimit}
          </span>{" "}
          custom builds used this month
        </div>
      ) : null}

      {plan.signedIn && !plan.paid ? (
        <div className="flex max-w-2xl items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: FREE_BUILDS }).map((_, i) => (
              <span
                key={i}
                className={
                  i < used
                    ? "size-2.5 rounded-full bg-muted-foreground/40"
                    : "size-2.5 rounded-full bg-primary"
                }
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.freeRemaining} free custom build{plan.freeRemaining === 1 ? "" : "s"} left
          </p>
        </div>
      ) : null}

      <form onSubmit={(e) => void onResearch(e)} className="max-w-2xl space-y-4">
        <SongTypeahead
          song={song}
          artist={artist}
          instrument={instrument}
          onSong={setSong}
          onArtist={setArtist}
          onPick={(hit) => {
            setSong(hit.song);
            setArtist(hit.artist);
            if (hit.featuredId) openFeatured(hit.featuredId);
          }}
        />
        <PlaybackSelect value={playbackTarget} onChange={setPlaybackTarget} />
        <div className="flex items-end">
          <Button type="submit" disabled={busy || planPending} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Researching" : "Build this preset"}
          </Button>
        </div>
        {busy ? <ResearchProgress pct={progress} /> : null}
        <p className="text-xs text-muted-foreground">
          Using {instrument} · {DEVICE_MAP[stompModel]?.name ?? "HX Stomp"}. Change both in the header.
          Type two letters to pick the exact recording. “Playing through” is the speaker you will
          actually use — FRFR keeps the cab on, guitar amp skips it.
        </p>
        <GeminiHint plan={plan} pending={planPending} />
        {status && busy === false && !plan.canResearch ? (
          <p className="text-sm text-destructive">{status}</p>
        ) : null}
      </form>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">Demo — one tap, always works</h2>
          <span className="text-xs text-muted-foreground">Free download</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {demos.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Open ${p.song}`}
              data-tour={p.id === "featured-sandman" ? "demo-sandman" : undefined}
              onClick={() => openFeatured(p.id)}
              className="group rounded-xl border border-border border-l-2 border-l-primary bg-card p-5 text-left shadow-[var(--shadow-border)] hover:border-primary/50"
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{p.artist}</div>
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

      {rest.length ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-lg font-semibold">More known rigs</h2>
            <span className="text-xs text-muted-foreground">
              {plan.paid ? `${instrument} · replica` : "Unlock to open"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => {
              const locked = !plan.paid;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openFeatured(p.id)}
                  className="group rounded-xl border border-border bg-card p-5 text-left hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{p.artist}</div>
                    {locked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold">{p.song}</div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-foreground">
                    {locked ? "Unlock this rig" : "View replica"}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            The screen is the unit.{" "}
            <Link to="/guide" className="text-primary underline underline-offset-2">
              Full tutorial
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
          <p>
            <span className="block font-medium text-foreground">1. Demo or research</span>
            Name a track. See it on the unit. Download a .hlx HX Edit can import. Three demos always work.
          </p>
          <p>
            <span className="block font-medium text-foreground">2. Play the replica</span>
            Snapshot is verse/chorus. Stomp is effects on/off. Tap a switch, then tap what it should do.
          </p>
          <p>
            <span className="block font-medium text-foreground">3. Import the file</span>
            Download the .hlx. HX Edit: File → Import. PAGE until SNAP or STOMP matches.
          </p>
        </CardContent>
      </Card>

      <div className="max-w-2xl">
        <FeedbackCard />
      </div>
    </div>
  );
}
