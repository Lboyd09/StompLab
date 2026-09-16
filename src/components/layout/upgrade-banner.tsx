import { Link } from "@tanstack/react-router";
import { FREE_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, priceMonthlyLaunchUsd, formatUsd, type Plan } from "@/lib/plan";

export function UpgradeBanner({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (pending || plan.paid || plan.admin) return null;
  const left = plan.signedIn ? plan.freeRemaining : FREE_BUILDS;
  const lead = plan.signedIn
    ? left > 0
      ? `${left} free custom song${left === 1 ? "" : "s"} left`
      : "Free builds are used up"
    : `${FREE_BUILDS} free custom songs after you sign in`;
  return (
    <Link
      to="/upgrade"
      className="flex flex-col items-stretch gap-3 rounded-2xl bg-primary px-5 py-5 text-primary-foreground transition-opacity hover:opacity-90 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold uppercase leading-none tracking-tight">
          Subscribe — {formatUsd(priceMonthlyLaunchUsd())} first month
        </span>
        <span className="mt-1.5 block text-sm text-primary-foreground/75">
          {lead}. Then {formatUsd(PRICE_MONTHLY_USD)}/mo or {formatUsd(PRICE_YEARLY_USD)}/yr · 50 songs a month.
        </span>
      </span>
      <span className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-primary-foreground px-6 text-sm font-semibold text-primary sm:px-6">
        Get the Lab
      </span>
    </Link>
  );
}
