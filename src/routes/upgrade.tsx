import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RigDisclaimer } from "@/components/layout/disclaimer";
import { PAID_BUILD_LINE } from "@/lib/copy";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { confirmCheckout, startCheckout } from "@/lib/billing";
import {
  PRICE_MONTHLY_USD,
  PRICE_YEARLY_USD,
  LAUNCH_DISCOUNT_PERCENT,
  priceMonthlyLaunchUsd,
  priceMonthlyReferralUsd,
  yearlySavingsUsd,
  formatUsd,
  buildsUsedCopy,
  type PlanInterval,
  subscriptionCanceled,
} from "@/lib/plan";
import { getReferralMonthOffer } from "@/lib/referrals";
import { REFERRAL_SUBSCRIBE_PERCENT } from "@/lib/referral-code";
import { parseCheckoutId } from "@/lib/next-path";
import { usePlan } from "@/lib/use-plan";
import { LegalAgree } from "@/components/layout/legal-agree";
import { recordLegalAccept } from "@/lib/legal";

export const Route = createFileRoute("/upgrade")({
  validateSearch: (s: Record<string, unknown>): { checkout_id?: string } => ({
    checkout_id: typeof s.checkout_id === "string" ? s.checkout_id : undefined,
  }),
  component: UpgradePage,
});

const PERKS = [
  "Any song you play: a .hlx for HX Edit or a .pgp for POD Go Edit, built for your unit.",
  `${PAID_BUILD_LINE} Revise a tone that's off with one tap.`,
  "Every rig in the library, plus Create: describe a sound or a player.",
  "Your gear locker on every device, so presets use what you own.",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Will it load on my unit?",
    a: "Files are built for HX Stomp, HX Stomp XL, Helix Floor, Helix LT, HX Effects and POD Go. Pick yours in the header before you build.",
  },
  {
    q: "What if it doesn't sound right?",
    a: "Tap what's off (too dark, more gain, wrong amp) and the Lab rebuilds it. Every knob is also editable before you download.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from Account. You keep access until the period you paid for ends.",
  },
];

function UpgradePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const { plan, refresh, isPending: planPending } = usePlan();
  const [busy, setBusy] = useState<PlanInterval | null>(null);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [interval, setInterval] = useState<PlanInterval>("month");
  const checkoutId = parseCheckoutId(search.checkout_id);
  const [confirming, setConfirming] = useState(Boolean(checkoutId));
  const [monthOff, setMonthOff] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getReferralMonthOffer()
      .then((res) => {
        if (!cancelled && res.ok) setMonthOff(res.eligible);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const id = checkoutId;
    if (!id) {
      setConfirming(false);
      return;
    }
    if (isPending) return;
    if (!user) {
      setConfirming(false);
      return;
    }
    let cancelled = false;
    setConfirming(true);
    void (async () => {
      let last = "";
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        try {
          const res = await confirmCheckout({ data: { checkoutId: id } });
          if (cancelled) return;
          if (res.ok) {
            await refresh();
            if (cancelled) return;
            await navigate({ to: "/" });
            return;
          }
          last = res.error;
          if (!/still finishing|Wait a few|not issued|Could not confirm/i.test(res.error)) {
            setError(res.error);
            return;
          }
        } catch (err) {
          last = err instanceof Error ? err.message : "Could not confirm payment.";
        }
        await new Promise((r) => window.setTimeout(r, 700 + i * 250));
      }
      if (cancelled) return;
      setError(
        last ||
          "Polar is still finishing this payment. Refresh in a few seconds — you will not be charged twice.",
      );
    })()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not confirm payment.");
      })
      .finally(() => {
        if (!cancelled) setConfirming(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutId, user?.id, isPending, refresh, navigate, user]);

  async function onSubscribe(interval: PlanInterval) {
    setError("");
    if (!user) {
      await navigate({ to: "/login", search: { next: "/upgrade" } });
      return;
    }
    if (!agreed) {
      setError("Tick the box above to agree to the Terms and automatic renewal, then subscribe.");
      return;
    }
    setBusy(interval);
    try {
      const latest = await refresh();
      const polarActive = latest.polarLinked && !subscriptionCanceled(latest);
      if (latest.paid && polarActive && !latest.admin) {
        return;
      }
      if (latest.admin && polarActive) {
        setError("This admin account already has a Polar subscription. Cancel it from Account to test again.");
        return;
      }
      recordLegalAccept("subscribe");
      const res = await startCheckout({ data: { interval } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.url || !/^https?:\/\//i.test(res.url)) {
        setError("Checkout isn't available right now. Try again in a minute.");
        return;
      }
      window.location.href = res.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed.";
      if (/unauthorized/i.test(msg)) {
        await navigate({ to: "/login", search: { next: "/upgrade" } });
        setError("Sign in again, then tap Subscribe. Polar never sees a guest checkout.");
        return;
      }
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  if (isPending || planPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 py-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user && checkoutId) {
    return <Navigate to="/login" search={{ next: "/upgrade", checkout_id: checkoutId }} />;
  }

  const polarActive = plan.polarLinked && !subscriptionCanceled(plan);
  if (plan.paid && polarActive && !plan.admin && !confirming && !checkoutId) {
    return (
      <div className="grid place-items-center py-8 text-foreground">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stomp Lab</p>
          <h1 className="sl-hero-title text-[clamp(2.4rem,7vw,3.2rem)]">You're subscribed</h1>
          <p className="text-sm text-muted-foreground">
            {buildsUsedCopy(plan)}
            {plan.planInterval ? ` ${plan.planInterval === "year" ? "Yearly" : "Monthly"} plan.` : ""}
          </p>
          <Button asChild>
            <Link to="/">Back to Lab</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (plan.admin && polarActive && !confirming && !checkoutId) {
    return (
      <div className="grid place-items-center py-8 text-foreground">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stomp Lab</p>
          <h1 className="sl-hero-title text-[clamp(2.2rem,6vw,3rem)]">Admin — Polar is linked</h1>
          <p className="text-sm text-muted-foreground">
            This inbox already has a Polar subscription for testing. Cancel or manage it from Account.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/account">Account</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/">Back to Lab</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const saving = yearlySavingsUsd();
  const firstMonth = monthOff ? priceMonthlyReferralUsd() : priceMonthlyLaunchUsd();

  return (
    <div className="relative overflow-x-clip">
      <div className="relative z-10 mx-auto w-full max-w-xl space-y-6">
        <div className="space-y-3">
          <p className="sl-kicker">The full Lab</p>
          <h1 className="sl-hero-title text-[clamp(2.2rem,7vw,3.6rem)]">Every song on your setlist, ready to import</h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Type a song, get the file. One commercial preset pack often costs more than a month here.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div role="radiogroup" aria-label="Billing" className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
            {(["month", "year"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={interval === id}
                onClick={() => setInterval(id)}
                className={`min-h-11 rounded-lg px-3 text-sm font-medium ${
                  interval === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {id === "month" ? "Monthly" : `Yearly · save ${formatUsd(yearlySavingsUsd())}`}
              </button>
            ))}
          </div>

          <div>
            <p className="sl-hero-title text-5xl tabular-nums">
              {interval === "month" ? formatUsd(firstMonth) : formatUsd(PRICE_YEARLY_USD)}
              <span className="ml-1 text-base font-normal tracking-normal text-muted-foreground">
                {interval === "month" ? " first month" : "/yr"}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {interval === "month" ? (
                <>
                  Then {formatUsd(PRICE_MONTHLY_USD)}/mo.{" "}
                  {monthOff
                    ? `Invite: ${REFERRAL_SUBSCRIBE_PERCENT}% off the first month. The friend who invited you gets the same cut.`
                    : `${LAUNCH_DISCOUNT_PERCENT}% off the first month.`}
                </>
              ) : (
                <>
                  {formatUsd(PRICE_YEARLY_USD / 12)}/mo, billed yearly. Save {formatUsd(saving)} compared with monthly.
                </>
              )}
            </p>
          </div>

          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-3 border-t border-border pt-5">
            <LegalAgree kind="subscribe" checked={agreed} onChange={setAgreed} />
            <Button
              type="button"
              size="lg"
              className="h-12 w-full"
              aria-disabled={!agreed || busy !== null || confirming}
              disabled={busy !== null || confirming}
              onClick={() => void onSubscribe(interval)}
            >
              {busy || confirming ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirming
                ? "Confirming payment…"
                : busy
                  ? "Opening checkout…"
                  : `Subscribe — ${interval === "month" ? `${formatUsd(firstMonth)} first month` : `${formatUsd(PRICE_YEARLY_USD)}/year`}`}
            </Button>
            {!agreed && !error ? (
              <p className="text-sm text-muted-foreground">Tick the box above to subscribe.</p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Paid through Polar. Cancel any time from Account; you keep access until the period ends.
              {user?.primaryEmail ? ` The subscription is tied to ${user.primaryEmail}.` : ""}
            </p>
          </div>
        </div>

        <dl className="space-y-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>

        <RigDisclaimer />

        <p className="text-sm text-muted-foreground">
          Not ready?{" "}
          <Link to="/" className="text-primary underline underline-offset-2">
            Try the free demos
          </Link>
          : Enter Sandman, Teen Spirit, Comfortably Numb.
        </p>
      </div>
    </div>
  );
}
