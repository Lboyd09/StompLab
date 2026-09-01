import { Link } from "@tanstack/react-router";
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
        className="grid h-10 shrink-0 place-items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
      >
        Sign in
      </Link>
    );
  }
  const letter = (user.displayName ?? user.primaryEmail ?? "A").charAt(0).toUpperCase();
  return (
    <Link
      to="/account"
      aria-label="Account"
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card text-sm font-medium"
    >
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="size-10 object-cover" />
      ) : (
        letter
      )}
    </Link>
  );
}
