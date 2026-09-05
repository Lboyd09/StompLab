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
    <div className="space-y-16 md:space-y-24">
      <UpgradeBanner plan={plan} pending={planPending} />

      <section className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
            Line 6 laboratory
          </p>
          <h1 className="font-display text-[clamp(3.25rem,14vw,7.5rem)] font-semibold uppercase leading-[0.82] tracking-tight">
            Stomp Lab
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            Type a song. Get a preset that sounds like the record — path, knobs, snapshots, and a file
            HX Edit or POD Go Edit will import.
          </p>
          <p className="text-sm text-muted-foreground">
            Three demos always work. No account. Your unit: {DEVICE_MAP[stompModel]?.name ?? "HX Stomp"}.
          </p>
          <RigDisclaimer />
        </div>

        {plan.signedIn && plan.paid ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {plan.admin ? "Unlimited" : `${plan.monthUsed} / ${plan.monthLimit}`}
            </span>{" "}
            {plan.admin ? "custom builds — admin has no monthly cap" : "custom builds used this month"}
          </p>
        ) : null}

        {plan.signedIn && !plan.paid ? (
          <div className="flex items-center gap-3">
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

        <form onSubmit={(e) => void onResearch(e)} className="space-y-4">
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
          <Button type="submit" size="lg" disabled={busy || planPending} className="w-full sm:w-auto sm:px-8">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Researching" : "Build this preset"}
          </Button>
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
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Always free</p>
            <h2 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">Demos</h2>
          </div>
          <span className="text-xs text-muted-foreground">One tap. Download included.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {demos.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Open ${p.song}`}
              data-tour={p.id === "featured-sandman" ? "demo-sandman" : undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                openFeatured(p.id);
              }}
              className="group rounded-2xl border border-border bg-card p-6 text-left transition-[border-color,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:border-foreground/30"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{p.artist}</div>
              <div className="mt-2 font-display text-2xl font-semibold uppercase leading-none tracking-tight">{p.song}</div>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
              <div className="mt-6 flex items-center gap-1 text-xs font-medium text-foreground">
                Open on Stomp
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {rest.length ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Known rigs</p>
              <h2 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">More songs</h2>
            </div>
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
                  onPointerDown={(e) => {
                    e.preventDefault();
                    openFeatured(p.id);
                  }}
                  className="group rounded-2xl border border-border bg-card p-6 text-left hover:border-foreground/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{p.artist}</div>
                    {locked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
                  </div>
                  <div className="mt-2 font-display text-xl font-semibold uppercase leading-none tracking-tight">{p.song}</div>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
                  <div className="mt-6 flex items-center gap-1 text-xs font-medium text-foreground">
                    {locked ? "Unlock this rig" : "View replica"}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 border-t border-border pt-12 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="font-display text-4xl font-semibold uppercase leading-none">01</p>
          <h2 className="font-display text-lg font-semibold uppercase tracking-tight">Demo or research</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Name a track. See it on the unit. Download a .hlx HX Edit can import. Three demos always work.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-display text-4xl font-semibold uppercase leading-none">02</p>
          <h2 className="font-display text-lg font-semibold uppercase tracking-tight">Play the replica</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Snapshot is verse/chorus. Stomp is effects on/off. Tap a switch, then tap what it should do.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-display text-4xl font-semibold uppercase leading-none">03</p>
          <h2 className="font-display text-lg font-semibold uppercase tracking-tight">Import the file</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Download the .hlx. HX Edit: File → Import. PAGE until SNAP or STOMP matches.{" "}
            <Link to="/guide" className="text-foreground underline underline-offset-2">
              Full tutorial
            </Link>
          </p>
        </div>
      </section>

      <div className="max-w-2xl">
        <FeedbackCard />
      </div>
    </div>
  );
}
