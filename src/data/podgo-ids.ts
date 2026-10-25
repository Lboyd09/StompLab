import { PODGO_MODEL_IDS } from "./podgo-ids.gen";

// Which models POD Go has, without its 300 KB parameter catalog, so every page can ask cheaply.
const IDS = new Set(PODGO_MODEL_IDS);

/** The POD Go @model for a Helix id, given where it sits (before the amp = mono, after the cab = stereo). */
export function podGoIdFor(helixId: string, stage: "pre" | "post"): string | undefined {
  const id = POD_GO_STAND_INS[helixId] ?? helixId;
  if (IDS.has(id)) return id;
  const order = stage === "pre" ? ["Mono", "Stereo"] : ["Stereo", "Mono"];
  const versioned = /^(.*?)(V\d)$/.exec(id);
  for (const suffix of order) {
    if (IDS.has(id + suffix)) return id + suffix;
    // "HD2_DelayVintageDigitalV2" is "HD2_DelayVintageDigitalStereoV2" on POD Go.
    if (versioned && IDS.has(versioned[1] + suffix + versioned[2])) return versioned[1] + suffix + versioned[2];
  }
  return undefined;
}

/** Helix models POD Go 2.50 does not have, and the closest model it does. */
export const POD_GO_STAND_INS: Record<string, string> = {
  // Roland RE-201 Space Echo → the closest tape echo on POD Go.
  HD2_DelayCosmosEcho: "HD2_DelayTransistorTape",
};
