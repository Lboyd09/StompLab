import { toast } from "sonner";
import { resendVerificationEmail } from "./billing";
import { monthlyCapLine } from "./plan";
import { REFERRAL_BONUS } from "./referral-code";
import type { ResearchErr } from "./research";

/** Paid player at the monthly cap: the reset date and a way to get more now. */
export function notifyMonthlyCap(invite?: () => void) {
  toast.message(monthlyCapLine(REFERRAL_BONUS), {
    action: {
      label: "Invite a friend",
      onClick: invite ?? (() => window.location.assign("/account#invite")),
    },
    duration: 12000,
  });
}

export function notifyResearchError(
  err: ResearchErr,
  go: { login: () => void; upgrade: () => void },
) {
  if (err.reason === "signin") {
    toast.error(err.error, { action: { label: "Sign in", onClick: go.login }, duration: 8000 });
    return;
  }
  if (err.reason === "paywall") {
    toast.error(err.error, { action: { label: "Subscribe", onClick: go.upgrade }, duration: 8000 });
    return;
  }
  if (err.reason === "quota") {
    notifyMonthlyCap();
    return;
  }
  if (err.reason === "verify") {
    toast.error(err.error, {
      action: {
        label: "Resend email",
        onClick: () => {
          void resendVerificationEmail()
            .then((res) => (res.ok ? toast.success("Sent. Check your email.") : toast.error(res.error)))
            .catch(() => toast.error("We couldn't send that email. Try again in a minute."));
        },
      },
      duration: 10000,
    });
    return;
  }
  const raw = err.error || "Research failed";
  const error = /self-signed|certificate|unable_to_verify/i.test(raw)
    ? "Could not reach research. Try a demo, then try again in a minute."
    : raw;
  toast.error(error);
}

export function notifyResearchSource(source: "library" | "cache" | "gemini" | "local") {
  if (source === "library") toast.success("Loaded a built-in demo. Ready to copy onto the Stomp.");
  else if (source === "local") toast.success("Matched from the Line 6 catalog.");
  else if (source === "cache") toast.success("Loaded a saved research. Ready to copy onto the Stomp.");
  else toast.success("Researched and saved.");
}
