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
  if (plan.paid) {
    return (
      <p className="text-xs text-muted-foreground">
        {plan.monthUsed} of {plan.monthLimit} custom builds used this month. Featured, demos, and
        library hits do not count.
      </p>
    );
  }
  if (plan.freeRemaining <= 0) {
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
  const n = plan.freeRemaining;
  return (
    <p className="text-xs text-muted-foreground">
      {n} free song{n === 1 ? "" : "s"} left. Featured demos never count.
    </p>
  );
}
