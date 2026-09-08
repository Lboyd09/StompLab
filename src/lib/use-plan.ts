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

function planStoreKey(id: string) {
  return `stomplab.plan.v1.${id}`;
}

function readStoredPlan(id: string | null): Plan | null {
  if (!id || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(planStoreKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Plan;
    if (!parsed || parsed.userId !== id || !parsed.signedIn) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredPlan(plan: Plan) {
  if (!plan.userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(planStoreKey(plan.userId), JSON.stringify(plan));
  } catch {
    /* ignore quota */
  }
}

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
    writeStoredPlan(next);
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
      let kept: Plan | null = null;
      setPlan((prev) => {
        const stored = readStoredPlan(id);
        if (prev.signedIn && prev.userId === id) {
          kept = prev;
          setReady(true);
          return prev;
        }
        if (stored) {
          kept = stored;
          setReady(true);
          return stored;
        }
        const fallback = assemblePlan({
          userId: id,
          email: em,
          paid: false,
          freeUsed: 0,
          monthUsed: 0,
        });
        kept = fallback;
        setReady(true);
        return fallback;
      });
      return kept ?? emptyPlan();
    }
  }, [applyPlan]);

  useEffect(() => {
    setReady(false);
    setPlan((prev) => {
      if (prev.userId === userId && userId) return prev;
      return readStoredPlan(userId) ?? emptyPlan();
    });
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
