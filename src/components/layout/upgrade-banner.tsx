import { Link } from "@tanstack/react-router";
import { FREE_BUILDS, LAUNCH_USD, PRICE_USD, type Plan } from "@/lib/plan";

export function UpgradeBanner({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (pending || plan.paid || plan.admin) return null;
  const left = plan.signedIn ? plan.freeRemaining : FREE_BUILDS;
  const lead = plan.signedIn
    ? `${left} free custom song${left === 1 ? "" : "s"} left · unlock any song — `
    : `${FREE_BUILDS} free custom songs after sign-in · unlock any song — `;
  return (
    <Link
      to="/upgrade"
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm hover:border-primary/50"
    >
      <span className="text-muted-foreground">
        {lead}
        <span className="font-medium text-foreground">${LAUNCH_USD}</span>
        <span className="text-muted-foreground"> then ${PRICE_USD}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-primary">Unlock</span>
    </Link>
  );
}
