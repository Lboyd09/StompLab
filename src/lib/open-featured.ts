import type { PlaybackTarget, Preset, StompModelId, UserGear } from "@/data/types";
import { overlayUserGear } from "./preset-schema";
import { featuredOriginal, withStompModel } from "./preset-utils";
import { applyRouting } from "./rig-routing";
import { applyWahPreference, type WahMode } from "./wah";

/** What the player has set up: the unit, the gear locker, the wah, and what they play through. */
export type PlayerSettings = {
  stompModel: StompModelId;
  gear: UserGear[];
  wahMode: WahMode;
  wahModelId: string;
  playbackTarget: PlaybackTarget;
};

/** A featured rig fitted to the player: their unit, their gear, their wah choice, their routing. */
export function featuredForPlayer(src: Preset, settings: PlayerSettings): Preset {
  return applyRouting(
    applyWahPreference(
      overlayUserGear(withStompModel(src, settings.stompModel), settings.gear),
      settings.wahMode,
      settings.wahModelId,
    ),
    settings.playbackTarget,
  );
}

/**
 * Every place that opens a demo or featured rig (Lab, search, tutorial, History, Setlists) comes
 * through here. A copy the player already edited on this unit is returned as it is, never rebuilt
 * over; otherwise the rig is fitted fresh to the player's settings. `save` is false for the edited
 * copy (it is in History already).
 */
export function openFeatured(
  id: string,
  settings: PlayerSettings,
  stored: Preset[],
): { preset: Preset; save: boolean } | null {
  const src = featuredOriginal(id);
  if (!src) return null;
  const targetId = `${src.id}-${settings.stompModel}`;
  const edited = stored.find((p) => p.id === targetId && p.userEdited);
  if (edited) return { preset: edited, save: false };
  return { preset: featuredForPlayer({ ...src, createdAt: Date.now() }, settings), save: true };
}
