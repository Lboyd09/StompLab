import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { confirmCheckout, startCheckout } from "@/lib/billing";
import { FREE_BUILDS, LAUNCH_USD, PAID_MONTHLY_BUILDS, PRICE_USD } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/upgrade")({
  validateSearch: (s: Record<string, unknown>): { checkout_id?: string } => ({
    checkout_id: typeof s.checkout_id === "string" ? s.checkout_id : undefined,
  }),
  component: UpgradePage,
});

const PERKS = [
  "Type any song. Get a Stomp .hlx that sounds like the record.",
  `${PAID_MONTHLY_BUILDS} new custom builds every calendar month.`,
  "Create custom sounds. History. XL snapshot 4. Gear locker sync.",
  "Shared library of researched rigs — cache hits do not count.",
  "Featured demos stay free forever. No ads after you pay.",
];

function UpgradePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const { plan, refresh } = usePlan();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(Boolean(search.checkout_id));

  useEffect(() => {
    const id = search.checkout_id;
    if (!id || !user) {
      if (!isPending && !user) setConfirming(false);
      return;
    }
    setConfirming(true);
    void confirmCheckout({ data: { checkoutId: id } })
      .then(async (res) => {
        if (res.ok) {
          await refresh();
          await navigate({ to: "/" });
          return;
        }
        setError(res.error);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not confirm payment.");
      })
      .finally(() => setConfirming(false));
  }, [search.checkout_id, user, isPending, refresh, navigate]);

  async function onUnlock() {
    setError("");
    if (!user) {
      await navigate({ to: "/login", search: { next: "/upgrade" } });
      return;
    }
    setBusy(true);
    try {
      const res = await startCheckout();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  if (plan.paid && !confirming) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stomp Lab</p>
          <h1 className="font-display text-3xl font-semibold">You're unlocked</h1>
          <p className="text-sm text-muted-foreground">
            {plan.monthUsed} of {plan.monthLimit} custom builds used this month. Featured songs never
            count.
          </p>
          <Button asChild>
            <Link to="/">Back to Lab</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <div className="space-y-3">
          <Link to="/" className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            ← Back to Lab
          </Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Type any song.
            <span className="block text-muted-foreground">Get a Stomp preset.</span>
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            One-time unlock. Featured demos stay free. After {FREE_BUILDS} custom songs, this is the
            door.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Launch price</p>
              <p className="font-display text-5xl font-semibold tabular-nums">${LAUNCH_USD}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              then ${PRICE_USD}
              <span className="block">one time, not a subscription</span>
            </p>
          </div>
          <ul className="mt-6 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className="mt-6 w-full"
            disabled={busy || confirming || isPending}
            onClick={() => void onUnlock()}
          >
            {busy || confirming ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirming
              ? "Confirming payment…"
              : busy
                ? "Opening checkout…"
                : `Unlock StompLab — $${LAUNCH_USD}`}
          </Button>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Checkout is Polar (merchant of record). The unlock sticks to {user?.primaryEmail || "your email"}.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Not ready?{" "}
          <a href="/" className="text-primary underline underline-offset-2">
            Play the three demo songs
          </a>{" "}
          — Sandman, Teen Spirit, Comfortably Numb. Always works.
        </p>
      </div>
    </main>
  );
}
