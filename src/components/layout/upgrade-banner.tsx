import { Link } from "@tanstack/react-router";
import { LAUNCH_USD, PRICE_USD, type Plan } from "@/lib/plan";

export function UpgradeBanner({ plan }: { plan: Plan }) {
  if (plan.paid) return null;
  return (
    <Link
      to="/upgrade"
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm hover:border-primary/50"
    >
      <span className="text-muted-foreground">
        Unlock any song on your Stomp — launch{" "}
        <span className="font-medium text-foreground">${LAUNCH_USD}</span>
        <span className="text-muted-foreground"> (then ${PRICE_USD})</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-primary">Unlock</span>
    </Link>
  );
}
