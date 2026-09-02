import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitAuthedFeedbackFn, submitFeedbackFn } from "@/lib/billing";
import { usePlan } from "@/lib/use-plan";

const RATINGS = [1, 2, 3, 4, 5] as const;

export function PresetFeedbackDialog({
  song,
  open,
  onClose,
}: {
  song: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-4 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">After you play it</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">How close was the preset?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This goes into the prompt, not a one-off song fix. What you changed on the unit is the gold.
        </p>
        <PresetFeedbackForm song={song} onDone={onClose} />
        <button
          type="button"
          className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={onClose}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

export function PresetFeedbackForm({
  song,
  onDone,
}: {
  song: string;
  onDone?: () => void;
}) {
  const { plan } = usePlan();
  const [rating, setRating] = useState<number | undefined>();
  const [closerTweaks, setCloserTweaks] = useState("");
  const [wantPreset, setWantPreset] = useState("");
  const [wantApp, setWantApp] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating && closerTweaks.trim().length < 4 && wantPreset.trim().length < 4 && wantApp.trim().length < 4) {
      return;
    }
    setBusy(true);
    try {
      const payload = {
        kind: "preset" as const,
        song,
        rating,
        closerTweaks: closerTweaks.trim(),
        wantPreset: wantPreset.trim(),
        wantApp: wantApp.trim(),
        message: closerTweaks.trim() || wantPreset.trim() || wantApp.trim() || `Rated ${rating}/5`,
      };
      if (plan.signedIn) {
        await submitAuthedFeedbackFn({ data: payload });
      } else {
        await submitFeedbackFn({ data: payload });
      }
      toast.success("Got it — that helps the next song.");
      setCloserTweaks("");
      setWantPreset("");
      setWantApp("");
      setRating(undefined);
      onDone?.();
    } catch {
      toast.error("Could not send that. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-foreground">How close to the record?</p>
        <div className="mt-2 flex gap-1.5">
          {RATINGS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`size-9 rounded-md border text-sm font-medium ${
                rating === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              aria-label={`${n} out of 5`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <Field
        label="What did you change to get closer?"
        placeholder="Dropped Drive on Deez One to 4, swapped cab to Greenback…"
        value={closerTweaks}
        onChange={setCloserTweaks}
      />
      <Field
        label="What should this preset have had?"
        placeholder="A slapback before the amp, less hall, a real Klon always-on…"
        value={wantPreset}
        onChange={setWantPreset}
      />
      <Field
        label="What do you want in the Lab?"
        placeholder="IR picker, more snapshots, a setlist export…"
        value={wantApp}
        onChange={setWantApp}
      />
      <Button
        type="submit"
        disabled={
          busy ||
          (!rating &&
            closerTweaks.trim().length < 4 &&
            wantPreset.trim().length < 4 &&
            wantApp.trim().length < 4)
        }
      >
        {busy ? "Sending…" : "Send preset notes"}
      </Button>
    </form>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-20"
      />
    </label>
  );
}
