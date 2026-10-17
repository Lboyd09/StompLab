import { Link } from "@tanstack/react-router";
import { FREE_BUILD_LINE, PAID_BUILD_LINE } from "@/lib/copy";
import type { Plan } from "@/lib/plan";

export function GeminiHint({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (plan.signedIn) {
    if (plan.paid || plan.freeRemaining > 0) return null;
    return (
      <p className="text-xs text-muted-foreground">
        You've used your free custom builds. Demos stay free.{" "}
        <Link to="/upgrade" className="text-primary underline underline-offset-2">
          Subscribe
        </Link>{" "}
        for more. {PAID_BUILD_LINE}
      </p>
    );
  }
  if (pending) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {FREE_BUILD_LINE}{" "}
      <Link to="/login" className="text-primary underline underline-offset-2">
        Sign in
      </Link>
    </p>
  );
}
