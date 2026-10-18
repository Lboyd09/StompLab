import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlaybackSelect } from "@/components/layout/playback-select";
import { RigDisclaimer } from "@/components/layout/disclaimer";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { ResearchProgress } from "@/components/layout/research-progress";
import { SongTypeahead } from "@/components/layout/song-typeahead";
import { VerifyBanner } from "@/components/layout/verify-banner";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP } from "@/data/categories";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { PlaybackTarget } from "@/data/types";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { overlayUserGear } from "@/lib/preset-schema";
import { isDemoId, withStompModel } from "@/lib/preset-utils";
import { applyWahPreference } from "@/lib/wah";
import { matchFeatured, researchSongFn } from "@/lib/research";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { PAID_BUILD_LINE } from "@/lib/copy";
import { FREE_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, formatUsd, priceMonthlyLaunchUsd } from "@/lib/plan";
import { looksLikeRealSong } from "@/lib/song-check";
import { takeInviteResult } from "@/lib/referral-code";

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
  const wahMode = useAppStore((s) => s.wahMode);
  const wahModelId = useAppStore((s) => s.wahModelId);
  const savePreset = useAppStore((s) => s.savePreset);
  const search = Route.useSearch();
  const { plan, refresh, isPending: planPending } = usePlan();
  const [song, setSong] = useState(search.q ?? "");
  const [artist, setArtist] = useState("");
  const [picked, setPicked] = useState(false);
  const [playbackTarget, setPlaybackTarget] = useState<PlaybackTarget>("frfr");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const featured = FEATURED.filter((p) => p.instrument === instrument);
  const demos = featured.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));
  const rest = featured.filter((p) => !(DEMO_IDS as readonly string[]).includes(p.id));
  const subscribed = plan.paid || plan.admin;
  const unit = DEVICE_MAP[stompModel]?.name ?? "HX Stomp";
  const needsSong = !picked && !looksLikeRealSong(song, artist);

  useEffect(() => {
    if (search.q) setSong(search.q);
  }, [search.q]);

  useEffect(() => {
    const hit = takeInviteResult();
    if (!hit) return;
    if (hit.ok) {
      toast.success(`Invite applied. You got ${hit.bonus} extra custom builds.`);
    } else if (hit.error) {
      toast.message(hit.error);
    }
  }, []);

  function openFeatured(id: string) {
    const src = FEATURED.find((p) => p.id === id);
    if (!src) return;
    if (!isDemoId(src.id) && !plan.paid) {
      void navigate({ to: "/upgrade" });
      return;
    }
    const preset = applyWahPreference(
      overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, stompModel), gear),
      wahMode,
      wahModelId,
    );
    savePreset(preset);
    void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  async function onResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!song.trim()) {
      toast.error("Type a song title first.");
      setStatus("Type a song title first.");
      return;
    }
    // The server builds the lead part for two-guitar songs; nothing to pick here.
    const roleForBuild = "both" as const;
    const featuredHit = matchFeatured(song.trim(), artist.trim() || undefined, instrument, stompModel, roleForBuild);
    if (featuredHit) {
      const src = FEATURED.find(
        (p) => p.instrument === featuredHit.instrument && p.song === featuredHit.song,
      );
      if (src && isDemoId(src.id)) {
        savePreset(applyWahPreference(overlayUserGear(withStompModel(featuredHit, stompModel), gear), wahMode, wahModelId));
        notifyResearchSource("library");
        await navigate({ to: "/preset/$id", params: { id: featuredHit.id } });
        return;
      }
      if (src && !plan.paid) {
        await navigate({ to: "/upgrade" });
        return;
      }
      if (src && plan.paid) {
        savePreset(applyWahPreference(overlayUserGear(withStompModel(featuredHit, stompModel), gear), wahMode, wahModelId));
        notifyResearchSource("library");
        await navigate({ to: "/preset/$id", params: { id: featuredHit.id } });
        return;
      }
    }
    if (planPending) {
      toast.message("Still loading your account. Try again in a second.");
      return;
    }
    if (!plan.signedIn) {
      await navigate({ to: "/login", search: { next: "/" } });
      return;
    }
    if (!plan.canResearch) {
      if (plan.paid) {
        toast.error("You've used this month's custom builds. Demos still work. Resets next calendar month.");
        return;
      }
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
          wahMode,
          wahModelId,
          guitarRole: roleForBuild,
        },
      });
      if (!result || !result.ok) {
        const fail = result && !result.ok
          ? result
          : { ok: false as const, error: "Research failed. Try a demo, then try that song again." };
        if (fail.reason === "quota") {
          toast.error(fail.error);
          setStatus(fail.error);
          return;
        }
        if (fail.reason === "paywall") {
          await navigate({ to: "/upgrade" });
          return;
        }
        if (fail.reason === "signin") {
          await navigate({ to: "/login", search: { next: "/" } });
          return;
        }
        notifyResearchError(fail, {
          login: () => void navigate({ to: "/login" }),
          upgrade: () => void navigate({ to: "/upgrade" }),
        });
        setStatus(fail.error);
        return;
      }
      savePreset(result.preset);
      notifyResearchSource(result.source);
      await refresh();
      await navigate({ to: "/preset/$id", params: { id: result.preset.id } });
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Could not research that song. Try a demo, then try again.";
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

  const used = plan.signedIn && !plan.paid ? Math.min(plan.monthLimit || FREE_BUILDS, plan.freeUsed) : 0;

  return (
    <div className="space-y-10 md:space-y-14">
      <section className="relative mx-auto max-w-3xl space-y-6" data-tutorial="lab">
        <div className="relative space-y-5">
          <p className="sl-kicker sl-enter sl-enter-1">For Line 6</p>
          <h1 className="sl-hero-title text-[clamp(2.6rem,9vw,5.2rem)]">
            <span className="sl-enter sl-enter-2 block">Type a song.</span>
            <span className="sl-enter sl-enter-3 mt-2 block text-primary">
              Get that {instrument === "bass" ? "bass" : "guitar"} rig.
            </span>
          </h1>
          <span className="sl-enter sl-enter-3 sl-hero-rule" aria-hidden />
          <p className="sl-enter sl-enter-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            We research the gear on the record and build a preset for your {unit}: the chain, the knobs, and a
            switch for each part of the song.
          </p>
          {subscribed ? (
            <p className="sl-enter sl-enter-5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {plan.admin ? plan.monthUsed : `${plan.monthUsed} / ${plan.monthLimit}`}
              </span>{" "}
              {plan.admin ? "custom builds this month, no cap on this account" : "custom builds used this month"}
            </p>
          ) : null}
        </div>

        <VerifyBanner plan={plan} />

        {plan.signedIn && !plan.paid ? (
          <div className="relative flex items-center gap-3">
            {plan.monthLimit <= 6 ? (
              <div className="flex gap-1.5" aria-hidden>
                {Array.from({ length: plan.monthLimit }).map((_, i) => (
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
            ) : null}
            <p className="text-sm text-muted-foreground">
              {plan.freeRemaining} free custom build{plan.freeRemaining === 1 ? "" : "s"} left
            </p>
          </div>
        ) : null}

        <form id="lab-form" noValidate onSubmit={(e) => void onResearch(e)} className="sl-tour-target relative space-y-4 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6" data-tutorial="lab-form">
          <span className="sl-form-bar" aria-hidden />
          <SongTypeahead
            song={song}
            artist={artist}
            instrument={instrument}
            onSong={(value) => {
              setSong(value);
              setPicked(false);
            }}
            onArtist={(value) => {
              setArtist(value);
              setPicked(false);
            }}
            onPick={(hit) => {
              setSong(hit.song);
              setArtist(hit.artist);
              setPicked(true);
              if (hit.featuredId) openFeatured(hit.featuredId);
            }}
          />
          <PlaybackSelect value={playbackTarget} onChange={setPlaybackTarget} />
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={busy || planPending || needsSong}
              aria-describedby={needsSong ? "build-hint" : undefined}
              className="w-full sm:w-auto sm:px-8"
            >
              {busy || planPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Researching" : planPending ? "Loading your account" : "Build this preset"}
            </Button>
          </div>
          {needsSong && !busy ? (
            <p id="build-hint" className="text-sm text-muted-foreground">
              Pick a song from the list or type the full title and artist.
            </p>
          ) : null}
          {busy ? <ResearchProgress pct={progress} /> : null}
          {gear.length ? (
            <p className="text-xs text-muted-foreground">
              Using your gear: {gear.length} piece{gear.length === 1 ? "" : "s"} from your locker.
            </p>
          ) : null}
          <GeminiHint plan={plan} pending={planPending} />
          {status && busy === false ? (
            <p className="text-sm text-destructive">{status}</p>
          ) : null}
        </form>
      </section>

      <section className="space-y-6" id="demos">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="sl-kicker">Always free</p>
            <h2 className="sl-hero-title text-3xl">Demos</h2>
          </div>
          <span className="text-xs text-muted-foreground">No account needed</span>
        </div>
        <div className="sl-stagger grid gap-3 sm:grid-cols-3">
          {demos.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Open ${p.song}`}
              data-tour={p.id === "featured-sandman" ? "demo-sandman" : undefined}
              onClick={() => openFeatured(p.id)}
              className="sl-card group rounded-2xl border border-border bg-card p-6 text-left"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.artist}</div>
              <div className="mt-2 sl-hero-title text-2xl">{p.song}</div>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
              <div className="mt-6 flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:text-pop">
                Open on {unit}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {!subscribed ? (
        <section className="rounded-2xl bg-primary px-6 py-8 text-primary-foreground sm:px-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <h2 className="sl-hero-title text-3xl">Every song on your setlist</h2>
            <p className="max-w-md text-sm text-primary-foreground/80">
              {PAID_BUILD_LINE} {formatUsd(priceMonthlyLaunchUsd())} the first month, then{" "}
              {formatUsd(PRICE_MONTHLY_USD)}/mo or {formatUsd(PRICE_YEARLY_USD)}/yr. Cancel any time.
            </p>
          </div>
          <Button asChild variant="secondary" size="lg" className="h-12 w-full shrink-0 px-8 text-base sm:w-auto">
            <Link to="/upgrade">Subscribe</Link>
          </Button>
          </div>
        </section>
      ) : null}

      {rest.length ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="sl-kicker">Known rigs</p>
              <h2 className="sl-hero-title text-3xl">More songs</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {subscribed ? `${instrument} · replica` : "Subscribe to open"}
            </span>
          </div>
          <div className="sl-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => {
              const locked = !subscribed;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openFeatured(p.id)}
                  className="sl-card group rounded-2xl border border-border bg-card p-6 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{p.artist}</div>
                    {locked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
                  </div>
                  <div className="mt-2 sl-hero-title text-xl">{p.song}</div>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
                  <div className="mt-6 flex items-center gap-1 text-xs font-medium text-foreground transition-colors group-hover:text-pop">
                    {locked ? "Subscribe to open" : "View replica"}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <RigDisclaimer />
    </div>
  );
}
