import { useCallback, useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyPlan } from "@/lib/billing";
import { emptyPlan, type Plan } from "@/lib/plan";

export function usePlan() {
  const { user, isPending } = useCurrentUserState();
  const [plan, setPlan] = useState<Plan>(emptyPlan());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      const next = emptyPlan();
      setPlan(next);
      setReady(true);
      return next;
    }
    try {
      const next = await getMyPlan();
      setPlan(next);
      setReady(true);
      return next;
    } catch {
      const next = emptyPlan();
      setPlan(next);
      setReady(true);
      return next;
    }
  }, [user]);

  useEffect(() => {
    if (isPending) return;
    void refresh();
  }, [isPending, refresh]);

  return { plan, isPending: isPending || !ready, refresh };
}
