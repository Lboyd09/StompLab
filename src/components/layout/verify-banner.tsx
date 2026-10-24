import { MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { resendVerificationEmail } from "@/lib/billing";
import type { Plan } from "@/lib/plan";

/** Free accounts can't build until the email is confirmed. Say so before they try. */
export function VerifyBanner({ plan }: { plan: Plan }) {
  const { user, isPending } = useCurrentUserState();
  const [sending, setSending] = useState(false);
  if (isPending || !user || user.isDevFallback || user.emailVerified) return null;
  if (!plan.signedIn || plan.paid || plan.admin) return null;

  async function resend() {
    setSending(true);
    try {
      const res = await resendVerificationEmail();
      if (res.ok) toast.success("Sent. Check your email.");
      else toast.error(res.error);
    } catch {
      toast.error("We couldn't send that email. Try again in a minute.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3 sm:p-4">
      <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1 sm:space-y-2">
        <p className="text-sm font-medium text-foreground">Confirm your email to start building</p>
        <p className="hidden break-words text-sm text-muted-foreground sm:block">
          We sent a link to {user.primaryEmail ?? "your inbox"}. Tap it and your free builds are ready. Demos work now.
        </p>
        <button
          type="button"
          disabled={sending}
          onClick={() => void resend()}
          className="min-h-11 text-sm font-medium sm:min-h-11 text-primary underline underline-offset-2 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send it again"}
        </button>
      </div>
    </div>
  );
}
