import { useState } from "react";
import { createPortal } from "react-dom";
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
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-background p-3 sm:bg-background/85 sm:p-6 sm:backdrop-blur-sm">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div className="shrink-0 px-6 pt-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">After you play it</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">How close was the preset?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            What you changed on the unit is the gold. Feedback improves the models and how close the next
            preset gets to the record — it is not a one-off song fix.
          </p>
        </div>
        <PresetFeedbackForm song={song} onDone={onClose} pinActions />
      </div>
    </div>,
    document.body,
  );
}

export function PresetFeedbackForm({
  song,
  onDone,
  pinActions = false,
}: {
  song: string;
  onDone?: () => void;
  pinActions?: boolean;
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
      toast.success("Got it — that improves the models and the next song.");
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
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={pinActions ? "flex min-h-0 flex-1 flex-col" : "mt-4 space-y-4"}
    >
      <div className={pinActions ? "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4" : "space-y-4"}>
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
      </div>
      <div
        className={
          pinActions
            ? "shrink-0 space-y-3 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "space-y-3"
        }
      >
      <Button
        type="submit"
        className="w-full"
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
      {onDone ? (
        <button
          type="button"
          className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={onDone}
        >
          Skip for now
        </button>
      ) : null}
      </div>
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
        className="min-h-16"
      />
    </label>
  );
}
