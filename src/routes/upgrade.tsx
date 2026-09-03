import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/layout/legal-footer";
import { RigDisclaimer } from "@/components/layout/disclaimer";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { confirmCheckout, startCheckout } from "@/lib/billing";
import {
  FREE_BUILDS,
  PAID_MONTHLY_BUILDS,
  PRICE_MONTHLY_USD,
  PRICE_YEARLY_USD,
  yearlySavingsUsd,
  formatUsd,
  type PlanInterval,
} from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/upgrade")({
  validateSearch: (s: Record<string, unknown>): { checkout_id?: string } => ({
    checkout_id: typeof s.checkout_id === "string" ? s.checkout_id : undefined,
  }),
  component: UpgradePage,
});

const PERKS = [
  "Type any song. Get a .hlx HX Edit will import.",
  `${PAID_MONTHLY_BUILDS} custom builds every calendar month.`,
  "Create custom sounds. History. Extra snapshots. Gear locker sync.",
  "Every custom research counts as one build — demos stay free forever.",
  "Cancel any time. Access lasts until the period ends.",
];

function UpgradePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const { plan, refresh, isPending: planPending } = usePlan();
  const [busy, setBusy] = useState<PlanInterval | null>(null);
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

  async function onSubscribe(interval: PlanInterval) {
    setError("");
    if (!user) {
      await navigate({ to: "/login", search: { next: "/upgrade" } });
      return;
    }
    setBusy(interval);
    try {
      const latest = await refresh();
      if (latest.paid) {
        return;
      }
      const res = await startCheckout({ data: { interval } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.url || !/^https?:\/\//.test(res.url)) {
        setError("Checkout did not return a payment page. Check Polar products on the host.");
        return;
      }
      window.location.href = res.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed.";
      if (/unauthorized/i.test(msg)) {
        await navigate({ to: "/login", search: { next: "/upgrade" } });
        return;
      }
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  if (isPending || planPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
        <p className="text-sm text-muted-foreground">Checking your account…</p>
      </main>
    );
  }

  if (plan.paid && !confirming && !search.checkout_id) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stomp Lab</p>
          <h1 className="font-display text-3xl font-semibold">{plan.admin ? "Admin — full Lab" : "You're subscribed"}</h1>
          <p className="text-sm text-muted-foreground">
            {plan.monthUsed} of {plan.monthLimit} custom builds used this month. Featured demos never
            count.
            {plan.planInterval ? ` ${plan.planInterval === "year" ? "Yearly" : "Monthly"} plan.` : ""}
          </p>
          <Button asChild>
            <Link to="/">Back to Lab</Link>
          </Button>
        </div>
      </main>
    );
  }

  const saving = yearlySavingsUsd();

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="grid size-10 place-items-center rounded-md bg-mark font-display text-lg font-bold tracking-[-0.08em] normal-case text-mark-foreground">
              SL
            </span>
            Back to Lab
          </Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Type any song.
            <span className="block text-muted-foreground">Subscribe when the three free builds are gone.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            {FREE_BUILDS} custom songs after sign-in. Featured demos stay free. Monthly or yearly —
            same {PAID_MONTHLY_BUILDS} builds a month either way.
          </p>
          <RigDisclaimer />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard
            label="Monthly"
            price={PRICE_MONTHLY_USD}
            period="/ month"
            cta={`Subscribe — ${formatUsd(PRICE_MONTHLY_USD)}/mo`}
            busy={busy === "month"}
            confirming={confirming}
            pending={isPending}
            onClick={() => void onSubscribe("month")}
            perks={PERKS}
          />
          <PlanCard
            label="Yearly"
            price={PRICE_YEARLY_USD}
            period="/ year"
            badge={`Save ${formatUsd(saving)}`}
            highlight
            cta={`Subscribe — ${formatUsd(PRICE_YEARLY_USD)}/yr`}
            busy={busy === "year"}
            confirming={confirming}
            pending={isPending}
            onClick={() => void onSubscribe("year")}
            perks={PERKS}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Checkout is Polar (merchant of record). Going back before you pay does not unlock anything.
          The subscription sticks to {user?.primaryEmail || "your email"} after Polar says it is active.
          Cancel any time; you keep the Lab until the period ends.
        </p>

        <p className="text-sm text-muted-foreground">
          Not ready?{" "}
          <a href="/" className="text-primary underline underline-offset-2">
            Play the three demo songs
          </a>{" "}
          — Sandman, Teen Spirit, Comfortably Numb. Always works.
        </p>

        <LegalFooter full />
      </div>
    </main>
  );
}

function PlanCard({
  label,
  price,
  period,
  badge,
  highlight,
  cta,
  busy,
  confirming,
  pending,
  onClick,
  perks,
}: {
  label: string;
  price: number;
  period: string;
  badge?: string;
  highlight?: boolean;
  cta: string;
  busy: boolean;
  confirming: boolean;
  pending: boolean;
  onClick: () => void;
  perks: string[];
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-6 ${
        highlight ? "border-primary" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        {badge ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-5xl font-semibold tabular-nums">
        {formatUsd(price)}
        <span className="ml-1 text-base font-normal text-muted-foreground">{period}</span>
      </p>
      <ul className="mt-6 space-y-3">
        {perks.map((p) => (
          <li key={p} className="flex gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Button type="button" className="mt-6 w-full" disabled={busy || confirming || pending} onClick={onClick}>
        {busy || confirming ? <Loader2 className="size-4 animate-spin" /> : null}
        {confirming ? "Confirming payment…" : busy ? "Opening checkout…" : cta}
      </Button>
    </div>
  );
}
