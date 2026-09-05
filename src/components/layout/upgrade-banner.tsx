import { Link } from "@tanstack/react-router";
import { FREE_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, formatUsd, type Plan } from "@/lib/plan";

export function UpgradeBanner({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (pending || plan.paid || plan.admin) return null;
  const left = plan.signedIn ? plan.freeRemaining : FREE_BUILDS;
  const lead = plan.signedIn
    ? `${left} free custom song${left === 1 ? "" : "s"} left · subscribe — `
    : `${FREE_BUILDS} free custom songs after sign-in · subscribe — `;
  return (
    <Link
      to="/upgrade"
      className="flex items-center justify-between gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-foreground/30"
    >
      <span className="text-muted-foreground">
        {lead}
        <span className="font-medium text-foreground">{formatUsd(PRICE_MONTHLY_USD)}/mo</span>
        <span className="text-muted-foreground"> or {formatUsd(PRICE_YEARLY_USD)}/yr</span>
      </span>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
        Plans
      </span>
    </Link>
  );
}
