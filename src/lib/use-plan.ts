import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyPlan } from "@/lib/billing";
import { assemblePlan, emptyPlan, planFingerprint, type Plan } from "@/lib/plan";

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
 *
 * Depend only on userId / email strings — Better Auth often returns a new `user`
 * object reference on session store ticks, and an effect keyed on that object
 * will hammer getMyPlan forever (Observability event storm).
 */
function usePlanState(): PlanState {
  const { user, isPending: authPending } = useCurrentUserState();
  const [plan, setPlan] = useState<Plan>(emptyPlan());
  const [ready, setReady] = useState(false);
  const userId = user?.id ?? null;
  const email = user?.primaryEmail ?? null;
  const userIdRef = useRef(userId);
  const emailRef = useRef(email);
  const genRef = useRef(0);
  userIdRef.current = userId;
  emailRef.current = email;

  const applyPlan = useCallback((next: Plan) => {
    setPlan((prev) => (planFingerprint(prev) === planFingerprint(next) ? prev : next));
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    const id = userIdRef.current;
    const em = emailRef.current;
    const gen = ++genRef.current;
    if (!id) {
      applyPlan(emptyPlan());
      return emptyPlan();
    }
    try {
      const next = await getMyPlan();
      if (gen !== genRef.current || userIdRef.current !== id) return next;
      applyPlan(next);
      return next;
    } catch {
      if (gen !== genRef.current || userIdRef.current !== id) return emptyPlan();
      // Keep them signed in. Admin email still unlocks via assemblePlan.
      // Never invent paid:true for a normal account.
      const fallback = assemblePlan({
        userId: id,
        email: em,
        paid: false,
        freeUsed: 0,
        monthUsed: 0,
      });
      applyPlan(fallback);
      return fallback;
    }
  }, [applyPlan]);

  useEffect(() => {
    setReady(false);
    setPlan(emptyPlan());
  }, [userId]);

  useEffect(() => {
    if (authPending) return;
    void refresh();
  }, [authPending, userId, refresh]);

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
