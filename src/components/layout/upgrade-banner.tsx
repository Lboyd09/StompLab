import { Link } from "@tanstack/react-router";
import { FREE_BUILD_LINE, PAID_BUILD_LINE } from "@/lib/copy";
import { FREE_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, priceMonthlyLaunchUsd, formatUsd, type Plan } from "@/lib/plan";

export function UpgradeBanner({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (pending || plan.paid || plan.admin) return null;
  const left = plan.signedIn ? plan.freeRemaining : FREE_BUILDS;
  const lead = plan.signedIn
    ? left > 0
      ? `${left} free custom build${left === 1 ? "" : "s"} left`
      : "You've used your free custom builds"
    : FREE_BUILD_LINE;
  return (
    <Link
      to="/upgrade"
      className="flex flex-col items-stretch gap-3 rounded-2xl bg-primary px-5 py-5 text-primary-foreground transition-opacity duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:opacity-90 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <span className="min-w-0">
        <span className="block sl-hero-title text-2xl">
          Subscribe — {formatUsd(priceMonthlyLaunchUsd())} first month
        </span>
        <span className="mt-1.5 block text-sm text-primary-foreground/75">
          {plan.signedIn ? `${lead}. ` : `${lead} `}
          Then {formatUsd(PRICE_MONTHLY_USD)}/mo or {formatUsd(PRICE_YEARLY_USD)}/yr · {PAID_BUILD_LINE}
        </span>
      </span>
      <span className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-primary-foreground px-6 text-sm font-semibold text-primary sm:px-6">
        Subscribe
      </span>
    </Link>
  );
}
