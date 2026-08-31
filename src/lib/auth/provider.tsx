import type { ReactNode } from "react";
import { PlanProvider } from "@/lib/use-plan";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone. PlanProvider is here so every page shares
 * one paid/free state instead of each mounting an empty plan.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <PlanProvider>{children}</PlanProvider>;
}
