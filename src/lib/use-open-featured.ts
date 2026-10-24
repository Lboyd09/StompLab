import { useCallback } from "react";
import type { Preset } from "@/data/types";
import { useAppStore } from "@/store/app-store";
import { openFeatured } from "./open-featured";

/**
 * Open a demo or featured rig for this player and keep it in History. Returns the preset to
 * navigate to (the player's edited copy when there is one), or null for an unknown id.
 * Paywall checks stay with the caller.
 */
export function useOpenFeatured(): (id: string, opts?: { save?: boolean }) => Preset | null {
  const savePreset = useAppStore((s) => s.savePreset);
  return useCallback(
    (id, opts) => {
      const s = useAppStore.getState();
      const opened = openFeatured(
        id,
        {
          stompModel: s.stompModel,
          gear: s.gear,
          wahMode: s.wahMode,
          wahModelId: s.wahModelId,
          playbackTarget: s.playbackTarget,
        },
        s.presets,
      );
      if (!opened) return null;
      if (opened.save && opts?.save !== false) savePreset(opened.preset);
      return opened.preset;
    },
    [savePreset],
  );
}
