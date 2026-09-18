import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { captureReferralCode, normalizeReferralCode, peekReferralCode, rememberInviteResult, clearReferralCode } from "@/lib/referral-code";
import { redeemReferral } from "@/lib/referrals";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => ({
    ref: typeof s.ref === "string" && s.ref.length ? s.ref : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [applied, setApplied] = useState(false);
  const code = normalizeReferralCode(search.ref ?? peekReferralCode());

  useEffect(() => {
    if (search.ref) captureReferralCode(search.ref);
  }, [search.ref]);

  useEffect(() => {
    if (!user || isPending) return;
    if (code.length < 4) {
      setApplied(true);
      return;
    }
    let cancelled = false;
    void redeemReferral({ data: { code } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          rememberInviteResult({ ok: true, bonus: res.bonus });
          clearReferralCode();
        } else {
          rememberInviteResult({ ok: false, error: res.error });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        rememberInviteResult({
          ok: false,
          error: err instanceof Error ? err.message : "Could not apply that invite.",
        });
      })
      .finally(() => {
        if (!cancelled) setApplied(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, code]);

  // Guests go straight to Create account — never Sign in. replace so Back isn't stuck.
  if (!user) {
    return <Navigate to="/login" search={{ mode: "up", ref: code || undefined, next: "/" }} replace />;
  }

  if (applied) return <Navigate to="/" />;

  return (
    <main className="grid min-h-[50vh] place-items-center px-6">
      <p className="text-sm text-muted-foreground">Applying your invite…</p>
    </main>
  );
}
