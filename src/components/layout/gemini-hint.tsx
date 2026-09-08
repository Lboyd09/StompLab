import { Link } from "@tanstack/react-router";
import type { Plan } from "@/lib/plan";

export function GeminiHint({ plan, pending }: { plan: Plan; pending?: boolean }) {
  if (pending) {
    return <p className="text-xs text-muted-foreground">Checking your account…</p>;
  }
  if (!plan.signedIn) {
    return (
      <p className="text-xs text-muted-foreground">
        Featured demos never need an account. Custom songs: sign in for 3 free builds.{" "}
        <Link to="/login" className="text-primary underline underline-offset-2">
          Sign in
        </Link>
      </p>
    );
  }
  if (plan.paid || plan.freeRemaining > 0) {
    return null;
  }
  return (
    <p className="text-xs text-muted-foreground">
      0 free songs left.{" "}
      <Link to="/upgrade" className="text-primary underline underline-offset-2">
        Unlock StompLab
      </Link>{" "}
      to research any song.
    </p>
  );
}
