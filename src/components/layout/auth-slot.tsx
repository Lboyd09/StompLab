import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="size-10 shrink-0 animate-pulse rounded-md bg-secondary" />;
  }
  if (!user) {
    return (
      <Link
        to="/login"
        className="grid h-10 shrink-0 place-items-center rounded-md border border-border bg-card px-3 text-xs font-medium"
      >
        Sign in
      </Link>
    );
  }
  return <UserButton />;
}
