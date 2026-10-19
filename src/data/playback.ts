import { DEVICE_MAP } from "./categories";
import type { PlaybackTarget, StompModelId } from "./types";

/**
 * How the file is routed for the rig:
 *   full    amp + cab in the file (FRFR, headphones, monitors, PA)
 *   pedals  no amp, no cab — the unit sits in front of a real guitar amp
 *   4cm     pedals → FX Loop (the real amp's preamp) → time effects; no amp, no cab
 *   no-cab  amp kept, cab removed — into a power amp or an amp's FX return
 */
export type Route = "full" | "pedals" | "4cm" | "no-cab";

export type PlaybackOption = {
  id: PlaybackTarget;
  label: string;
  hint: string;
  detail: string;
  prompt: string;
  route: Route;
};

export const PLAYBACK_TARGETS: PlaybackOption[] = [
  {
    id: "frfr",
    label: "FRFR / powered cab",
    hint: "Full-range speaker or modeler cab. Keep the cab/IR on.",
    detail:
      "Use this when the Stomp is the whole amp: Headrush, Powercab, FRFR wedge, or a PA-style speaker. The preset keeps the cab block so the speaker is already in the file.",
    prompt:
      "Playback: FRFR / powered cab. Keep cab (or IR) on. Honest mix — do not scoop the cab to fake a guitar speaker.",
    route: "full",
  },
  {
    id: "amp-front",
    label: "Guitar amp, front of the amp",
    hint: "Pedals only. Plug the output into your amp's input, set clean.",
    detail:
      "No amp or cab in the file. Your amp's clean channel is the amp. Drives are set like real pedals into a clean amp, levels near unity.",
    prompt:
      "Playback: the unit is a pedalboard in FRONT of the player's real guitar amp (clean channel). Pedals only: NO amp-guitar, amp-bass, preamp, cab, mic, or ir blocks. The real amp is clean, so the dirt the record has comes from drive pedals voiced for a clean amp's input (Drive/Gain where the pedal itself gives the record's gain, Level/Output near unity 5–6, a TS used as a boost only if the amp is already dirty on the record). No amp knobs exist: put clean/dirty changes on pedal on/off and pedal knobs. Keep modulation, delay, and reverb subtle — they run into the amp's preamp.",
    route: "pedals",
  },
  {
    id: "amp-4cm",
    label: "Guitar amp, 4-cable method",
    hint: "Pedals before your amp's preamp, delay and reverb in its FX loop.",
    detail:
      "Send goes to the amp input, the amp's FX send comes back into Return, and the output goes to the amp's FX return. No amp or cab in the file; an FX Loop block stands where the amp would be.",
    prompt:
      "Playback: 4-cable method with the player's real guitar amp. Its preamp sits where an amp block would be (the exporter puts an FX Loop block there). Do NOT emit amp-guitar, amp-bass, preamp, cab, mic, or ir blocks. Put wah, comp, gate, and drive pedals BEFORE the loop (in front of the amp's input: drives voiced for a clean amp channel, Level/Output near unity 5–6). Put modulation, delay, and reverb AFTER it (in the amp's loop) unless the record had them in front of the amp. Clean/dirty changes live on pedal on/off — there are no amp knobs.",
    route: "4cm",
  },
  {
    id: "power-amp",
    label: "Power amp / amp's FX return",
    hint: "Amp model kept, cab removed. Into a power amp or a real cab.",
    detail:
      "For a power amp into a guitar cab, or your amp's FX return. The modeled amp stays; the speaker is real, so no cab block.",
    prompt:
      "Playback: a power amp into a real guitar cab (or a guitar amp's FX return). Keep the amp block. NO cab, mic, or ir blocks — the speaker is real. Slightly darker dirt, less fizz.",
    route: "no-cab",
  },
  {
    id: "guitar-amp",
    label: "Guitar amp",
    hint: "Front-of-amp or FX loop into a real guitar cab. Skip the modeled cab.",
    detail:
      "You already have a speaker. We leave the cab/IR off so you are not stacking two cabinets. Slightly darker dirt, less fizz. Front-of-amp or 4-cable method.",
    prompt:
      "Playback: real guitar amp. Skip cab and IR blocks. Slightly darker dirt, less fizz. Player has a speaker.",
    // Older presets: they export as they always did.
    route: "full",
  },
  {
    id: "headphones",
    label: "Headphones",
    hint: "Direct. A little more bass and air so it does not feel thin.",
    detail:
      "Quiet practice into the headphone jack or an interface. Cab stays on. Bass and air come up a touch; reverb Mix a hair higher so it does not feel like a closet.",
    prompt:
      "Playback: headphones. Keep cab on. A touch more bass and air in the cab, reverb Mix slightly up. Not a night-and-day change.",
    route: "full",
  },
  {
    id: "monitors",
    label: "Studio monitors",
    hint: "Flatter, less hype. Mix as if you are sitting at a desk.",
    detail:
      "Nearfields at a desk. Cab stays on. Treble/Presence come down so it is not hyped, and the mix is built like a record, not a stage.",
    prompt:
      "Playback: studio monitors. Keep cab on. Flatter presence, less hype on Treble/Presence. Mix as a record, not a stage.",
    route: "full",
  },
  {
    id: "pa",
    label: "PA / FOH",
    hint: "Tighter low end, a little high-cut so it sits in a band.",
    detail:
      "Going to a house PA or FOH. Cab stays on. Low end is tighter, a little more high-cut, less room in the reverb so the engineer is not fighting wash.",
    prompt:
      "Playback: PA / FOH. Keep cab on. Tighter low end, a little more high cut, less room in the reverb so FOH is not washing.",
    route: "full",
  },
];

export const PLAYBACK_MAP: Record<PlaybackTarget, PlaybackOption> = Object.fromEntries(
  PLAYBACK_TARGETS.map((t) => [t.id, t]),
) as Record<PlaybackTarget, PlaybackOption>;

/** Not offered in the select any more (kept so saved presets still read). */
const LEGACY = new Set<PlaybackTarget>(["guitar-amp"]);

export function routeFor(target: PlaybackTarget | undefined): Route {
  return (target && PLAYBACK_MAP[target]?.route) || "full";
}

/** Whether this unit can be routed that way: 4CM needs a send/return, power-amp needs an amp model. */
export function playbackAllowed(target: PlaybackTarget, stompModel: StompModelId): boolean {
  const d = DEVICE_MAP[stompModel];
  if (!d) return target === "frfr";
  const route = routeFor(target);
  if (route === "4cm") return Boolean(d.fxLoopModel);
  if (route === "no-cab") return d.hasAmpCab;
  return true;
}

/** Options the "Playing through" select shows for this unit. */
export function playbackOptionsFor(stompModel: StompModelId): PlaybackOption[] {
  return PLAYBACK_TARGETS.filter((t) => !LEGACY.has(t.id) && playbackAllowed(t.id, stompModel));
}
