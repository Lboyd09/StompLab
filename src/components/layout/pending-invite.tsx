import { useEffect } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearReferralCode, isPermanentInviteError, peekReferralCode } from "@/lib/referral-code";
import { claimPendingInvite } from "@/lib/referrals";
import { usePlan } from "@/lib/use-plan";

const CLAIMED_KEY = "stomplab.inviteClaimed";

/**
 * An invite typed at sign-up waits for the confirmed email. On the first
 * signed-in load after that, pay it out and say so.
 */
export function PendingInviteClaim() {
  const { user } = useCurrentUserState();
  const { refresh } = usePlan();
  const userId = user?.id ?? "";
  const verified = Boolean(user?.emailVerified);

  useEffect(() => {
    if (!userId || !verified) return;
    try {
      if (window.sessionStorage.getItem(CLAIMED_KEY) === userId) return;
      window.sessionStorage.setItem(CLAIMED_KEY, userId);
    } catch {
      /* claim anyway; the server makes a repeat harmless */
    }
    const local = peekReferralCode();
    void claimPendingInvite({ data: { code: local || undefined } })
      .then(async (res) => {
        if ("none" in res) return;
        if (res.ok) {
          clearReferralCode();
          toast.success(`Invite applied. You got ${res.bonus} extra custom builds.`);
          await refresh();
          return;
        }
        if (isPermanentInviteError(res.error)) {
          clearReferralCode();
          toast.message(res.error);
        }
      })
      .catch(() => undefined);
  }, [userId, verified, refresh]);

  return null;
}
