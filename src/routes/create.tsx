import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { PaywallCard } from "@/components/layout/paywall-card";
import { ResearchProgress } from "@/components/layout/research-progress";
import { UpgradeBanner } from "@/components/layout/upgrade-banner";
import { PlaybackSelect } from "@/components/layout/playback-select";
import { RigDisclaimer } from "@/components/layout/disclaimer";
import { Button } from "@/components/ui/button";
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
  const savePreset = useAppStore((s) => s.savePreset);
  const { plan, refresh, isPending } = usePlan();
  const [description, setDescription] = useState("");
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

  if (!isPending && plan.signedIn && !plan.canCreate) {
    return (
      <PaywallCard
        title="You've used the three free custom songs"
        body="Unlock to describe any sound, keep history, and download every rig — not just the demos."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <UpgradeBanner plan={plan} pending={isPending} />
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Custom rig</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Describe a sound</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pedalboard, amp stack, or a feeling. You get a path on the replica and a .hlx HX Edit will
          import — for your {DEVICE_MAP[stompModel]?.name ?? "HX Stomp"}.
        </p>
        <RigDisclaimer />
      </header>

      {!plan.signedIn && !isPending ? (
        <p className="text-sm text-muted-foreground">
          Sign in for {plan.freeRemaining} free custom builds.{" "}
          <Link to="/login" search={{ next: "/create" }} className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <Label htmlFor="desc">Sound, pedalboard, or amp</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dumble-ish overdrive into a Twin, with a slow Univibe and a short plate…"
        />
        <PlaybackSelect value={playbackTarget} onChange={setPlaybackTarget} />
        <Button type="submit" disabled={busy || description.trim().length < 4 || isPending}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Building" : "Make the preset"}
        </Button>
        {busy ? <ResearchProgress pct={progress} /> : null}
        <GeminiHint plan={plan} pending={isPending} />
      </form>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Try one of these</p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescription(ex)}
            className="block w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
