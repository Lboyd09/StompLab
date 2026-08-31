import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitAuthedFeedbackFn, submitFeedbackFn } from "@/lib/billing";
import { usePlan } from "@/lib/use-plan";

export function FeedbackCard({ song = "" }: { song?: string }) {
  const { plan } = usePlan();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 4) return;
    setBusy(true);
    try {
      if (plan.signedIn) {
        await submitAuthedFeedbackFn({ data: { message: message.trim(), kind: song ? "preset" : "site", song } });
      } else {
        await submitFeedbackFn({ data: { message: message.trim(), kind: song ? "preset" : "site", song } });
      }
      toast.success("Got it. Thank you.");
      setMessage("");
    } catch {
      toast.error("Could not send that. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Feedback</h2>
      <p className="text-sm text-muted-foreground">
        Too dark, wrong amp, a bug, a song we should add — send it. This goes to the Lab, not a public thread.
      </p>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="The chorus is too scooped, or: I couldn't sign in with…"
        className="min-h-24"
      />
      <Button type="submit" variant="secondary" disabled={busy || message.trim().length < 4}>
        {busy ? "Sending…" : "Send feedback"}
      </Button>
    </form>
  );
}
