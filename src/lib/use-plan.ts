import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyPlan } from "@/lib/billing";
import { assemblePlan, emptyPlan, type Plan } from "@/lib/plan";

type PlanState = {
  plan: Plan;
  isPending: boolean;
  refresh: () => Promise<Plan>;
};

const PlanContext = createContext<PlanState | null>(null);

/**
 * One plan for the whole tree. Separate usePlan() calls were each starting at
 * emptyPlan() and racing getMyPlan — that's the "unlocked for a second, then
 * the ad" flicker.
 */
function usePlanState(): PlanState {
  const { user, isPending: authPending } = useCurrentUserState();
  const [plan, setPlan] = useState<Plan>(emptyPlan());
  const [ready, setReady] = useState(false);
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refresh = useCallback(async () => {
    if (!user) {
      setPlan(emptyPlan());
      setReady(true);
      return emptyPlan();
    }
    try {
      const next = await getMyPlan();
      if (userIdRef.current !== user.id) return next;
      setPlan(next);
      setReady(true);
      return next;
    } catch {
      if (userIdRef.current !== user.id) return emptyPlan();
      // Keep them signed in. Admin email still unlocks via assemblePlan.
      // Never invent paid:true for a normal account.
      const fallback = assemblePlan({
        userId: user.id,
        email: user.primaryEmail,
        paid: false,
        freeUsed: 0,
        monthUsed: 0,
      });
      setPlan(fallback);
      setReady(true);
      return fallback;
    }
  }, [user]);

  useEffect(() => {
    setReady(false);
    setPlan(emptyPlan());
  }, [userId]);

  useEffect(() => {
    if (authPending) return;
    void refresh();
  }, [authPending, refresh]);

  return { plan, isPending: authPending || !ready, refresh };
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const value = usePlanState();
  return createElement(PlanContext.Provider, { value }, children);
}

export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error("usePlan must be used inside AuthProvider");
  }
  return ctx;
}
