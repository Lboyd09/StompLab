import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { captureReferralCode, normalizeReferralCode, peekReferralCode } from "@/lib/referral-code";
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
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setApplied(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, code]);

  // Guests go straight to Create account — never Sign in.
  if (!user) {
    return <Navigate to="/login" search={{ mode: "up", ref: code || undefined, next: "/" }} />;
  }

  if (applied) return <Navigate to="/" />;

  return (
    <main className="grid min-h-[50vh] place-items-center px-6">
      <p className="text-sm text-muted-foreground">Applying your invite…</p>
    </main>
  );
}
