import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 4) return;
    if (!plan.signedIn) {
      await navigate({ to: "/login", search: { next: "/create" } });
      return;
    }
    if (!plan.canCreate) {
      await navigate({ to: "/upgrade" });
      return;
    }
    setBusy(true);
    try {
      const result = await createCustomSoundFn({
        data: {
          description: description.trim(),
          instrument,
          stompModel,
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
      setBusy(false);
    }
  }

  if (!isPending && plan.signedIn && !plan.canCreate) {
    return <Navigate to="/upgrade" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Describe a sound</h1>
        <p className="text-sm text-muted-foreground">
          A pedalboard, an amp stack, a feeling. Stomp Lab turns it into an HX path with knobs and
          footswitch programming for your {stompModel === "hx-stomp" ? "HX Stomp" : "HX Stomp XL"}.
        </p>
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
        <Button type="submit" disabled={busy || description.trim().length < 4 || isPending}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Building" : "Make the preset"}
        </Button>
        <GeminiHint plan={plan} />
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
