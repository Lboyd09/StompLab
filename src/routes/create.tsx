import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { PaywallCard } from "@/components/layout/paywall-card";
import { ResearchProgress } from "@/components/layout/research-progress";
import { UpgradeBanner } from "@/components/layout/upgrade-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PlaybackSelect } from "@/components/layout/playback-select";
import { RigDisclaimer } from "@/components/layout/disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEVICE_MAP } from "@/data/categories";
import type { PlaybackTarget } from "@/data/types";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { createCustomSoundFn } from "@/lib/research";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/create")({ component: CreatePage });

const EXAMPLES = [
  "Edge-of-breakup Deluxe Reverb with a Klon in front, slapback, spring reverb. Strat, neck pickup.",
  "Modern metal: tight gate, Tube Screamer into a Dual Rectifier, V30 cab, almost no reverb.",
  "Fretless bass DI with LA-2A compression, a little chorus, Darkglass blend for the chorus section.",
  "Shoegaze wall: Big Muff, reverse delay, shimmer verb, JC-120 clean underneath.",
];

function CreatePage() {
  const navigate = useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const gear = useAppStore((s) => s.gear);
  const wahMode = useAppStore((s) => s.wahMode);
  const wahModelId = useAppStore((s) => s.wahModelId);
  const savePreset = useAppStore((s) => s.savePreset);
  const { plan, refresh, isPending } = usePlan();
  const [description, setDescription] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playbackTarget, setPlaybackTarget] = useState<PlaybackTarget>("frfr");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 4) return;
    if (isPending) return;
    if (!plan.signedIn) {
      await navigate({ to: "/login", search: { next: "/create" } });
      return;
    }
    if (!plan.canCreate) {
      if (plan.paid) {
        toast.error("You've used this month's 50 custom builds. Featured demos still work. Resets next calendar month.");
        return;
      }
      await navigate({ to: "/upgrade" });
      return;
    }
    setBusy(true);
    setProgress(8);
    const tick = window.setInterval(() => {
      setProgress((p) => (p >= 94 ? 94 : p + 3));
    }, 450);
    try {
      const result = await createCustomSoundFn({
        data: {
          description: description.trim(),
          playerName: playerName.trim(),
          instrument,
          stompModel,
          playbackTarget,
          userGear: gear,
          wahMode,
          wahModelId,
          guitarRole: "both",
        },
      });
      if (!result.ok) {
        if (result.reason === "quota") {
          toast.error(result.error);
          return;
        }
        if (result.reason === "paywall") {
          await navigate({ to: "/upgrade" });
          return;
        }
        if (result.reason === "signin") {
          await navigate({ to: "/login", search: { next: "/create" } });
          return;
        }
        notifyResearchError(result, {
          login: () => void navigate({ to: "/login" }),
          upgrade: () => void navigate({ to: "/upgrade" }),
        });
        return;
      }
      savePreset(result.preset);
      notifyResearchSource(result.source);
      await refresh();
      await navigate({ to: "/preset/$id", params: { id: result.preset.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not build that sound";
      if (message === "Unauthorized") {
        await navigate({ to: "/login", search: { next: "/create" } });
        return;
      }
      toast.error(message);
    } finally {
      window.clearInterval(tick);
      setBusy(false);
      setProgress(0);
    }
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!plan.paid) {
    return (
      <PaywallCard
        title="Create is in the full Lab"
        body="Describe a custom sound, or optionally a player you want to sound like. Song research still uses your free builds. Create unlocks with a subscription."
      />
    );
  }

  if (!plan.canCreate) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-8">
        <h1 className="font-display text-3xl font-semibold uppercase tracking-tight">This month’s builds are used</h1>
        <p className="text-sm text-muted-foreground">
          Your subscription stays active. Custom research opens again at the start of next month. Demos
          never count.
        </p>
        <Button asChild>
          <Link to="/">Back to Lab</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-tutorial="create">
      <UpgradeBanner plan={plan} pending={isPending} />
      <PageHeader kicker="Custom rig" title="Describe a sound">
        Pedalboard, amp stack, or a feeling — we invent a new path on your{" "}
        {DEVICE_MAP[stompModel]?.name ?? "HX Stomp"}. This is not a song replica.
        If you want a record, use Research a song. Player name is optional.
      </PageHeader>
      <RigDisclaimer />

      <form onSubmit={(e) => void onSubmit(e)} className="relative space-y-4 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
        <span className="sl-form-bar" aria-hidden />
        <Label htmlFor="desc">Sound, pedalboard, or amp</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dumble-ish overdrive into a Twin, with a slow Univibe and a short plate…"
        />
        <div className="space-y-1.5">
          <Label htmlFor="player">Sound like a player (optional)</Label>
          <Input
            id="player"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g. David Gilmour — leave blank to invent a sound"
            maxLength={80}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Optional. If you type a name, we aim at their typical rig and attack — still a custom sound, not a
            song replica.
          </p>
        </div>
        <PlaybackSelect value={playbackTarget} onChange={setPlaybackTarget} />
        <Button type="submit" disabled={busy || description.trim().length < 4 || isPending}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Building" : "Make the preset"}
        </Button>
        {busy ? <ResearchProgress pct={progress} /> : null}
        <GeminiHint plan={plan} pending={isPending} />
      </form>

      <div className="space-y-2">
        <p className="sl-kicker">Try one of these</p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescription(ex)}
            className="sl-card block w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
