import { Link } from "@tanstack/react-router";
import type { Plan } from "@/lib/plan";

export function GeminiHint({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (plan.signedIn) {
    if (plan.paid || plan.freeRemaining > 0) return null;
    return (
      <p className="text-xs text-muted-foreground">
        0 free custom builds left.{" "}
        <Link to="/upgrade" className="text-primary underline underline-offset-2">
          Unlock Stomp Lab
        </Link>{" "}
        for 50 custom builds a month.
      </p>
    );
  }
  if (pending) return null;
  return (
    <p className="text-xs text-muted-foreground">
      3 free custom builds after you sign in. Demos stay free.{" "}
      <Link to="/login" className="text-primary underline underline-offset-2">
        Sign in
      </Link>
    </p>
  );
}
