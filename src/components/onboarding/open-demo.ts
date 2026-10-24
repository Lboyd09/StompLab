import { FEATURED } from "@/data/featured";
import type { PlaybackTarget, Preset, StompModelId, UserGear } from "@/data/types";
import { overlayUserGear } from "@/lib/preset-schema";
import { isDemoId, withStompModel } from "@/lib/preset-utils";
import { applyRouting } from "@/lib/rig-routing";
import { applyWahPreference, type WahMode } from "@/lib/wah";

/**
 * A free demo, built for the player's unit, gear, wah and rig — the same steps the home page uses.
 * Returns null for anything that isn't a free demo, so first-run can never open a paid rig.
 */
export function demoForRig(
  id: string,
  rig: { stompModel: StompModelId; gear: UserGear[]; wahMode: WahMode; wahModelId: string; playbackTarget: PlaybackTarget },
): Preset | null {
  const src = FEATURED.find((p) => p.id === id);
  if (!src || !isDemoId(src.id)) return null;
  return applyRouting(
    applyWahPreference(overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, rig.stompModel), rig.gear), rig.wahMode, rig.wahModelId),
    rig.playbackTarget,
  );
}
