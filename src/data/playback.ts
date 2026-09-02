import type { PlaybackTarget } from "./types";

export const PLAYBACK_TARGETS: {
  id: PlaybackTarget;
  label: string;
  hint: string;
  prompt: string;
}[] = [
  {
    id: "frfr",
    label: "FRFR / powered cab",
    hint: "Full-range speaker or modeler cab. Keep the cab/IR on.",
    prompt:
      "Playback: FRFR / powered cab. Keep cab (or IR) on. Honest mix — do not scoop the cab to fake a guitar speaker.",
  },
  {
    id: "guitar-amp",
    label: "Guitar amp",
    hint: "Front-of-amp or FX loop into a real guitar cab. Skip the modeled cab.",
    prompt:
      "Playback: real guitar amp. Skip cab and IR blocks. Slightly darker dirt, less fizz. Player has a speaker.",
  },
  {
    id: "headphones",
    label: "Headphones",
    hint: "Direct. A little more bass and air so it does not feel thin.",
    prompt:
      "Playback: headphones. Keep cab on. A touch more bass and air in the cab, reverb Mix slightly up. Not a night-and-day change.",
  },
  {
    id: "monitors",
    label: "Studio monitors",
    hint: "Flatter, less hype. Mix as if you are sitting at a desk.",
    prompt:
      "Playback: studio monitors. Keep cab on. Flatter presence, less hype on Treble/Presence. Mix as a record, not a stage.",
  },
  {
    id: "pa",
    label: "PA / FOH",
    hint: "Tighter low end, a little high-cut so it sits in a band.",
    prompt:
      "Playback: PA / FOH. Keep cab on. Tighter low end, a little more high cut, less room in the reverb so FOH is not washing.",
  },
];

export const PLAYBACK_MAP: Record<PlaybackTarget, (typeof PLAYBACK_TARGETS)[number]> = Object.fromEntries(
  PLAYBACK_TARGETS.map((t) => [t.id, t]),
) as Record<PlaybackTarget, (typeof PLAYBACK_TARGETS)[number]>;
