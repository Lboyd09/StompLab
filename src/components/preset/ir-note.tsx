import type { Preset } from "@/data/types";
import { userIrSlot } from "@/lib/hlx";
import { useAppStore } from "@/store/app-store";

/** SL-68: one line when the download swaps the stock cab for the player's IR. */
export function IrNote({ preset }: { preset: Preset }) {
  const slot = userIrSlot(preset, useAppStore((s) => s.irSlot));
  if (slot === undefined) return null;
  return <p className="text-xs text-muted-foreground">Uses your IR in slot {slot}.</p>;
}
