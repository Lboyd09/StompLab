import { DEVICE_MAP } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import { routeFor, type Route } from "@/data/playback";
import type { CategoryId, PlaybackTarget, Preset, StompBlock } from "@/data/types";
import { newId } from "./preset-utils";

/**
 * SL-62. The player's rig decides what goes in the file, not the model's mood:
 *   pedals  amp, cab, mic and IR blocks come out (the unit is a pedalboard in front of a real amp)
 *   4cm     same, and one FX Loop block takes the amp's place: pedals before it, time effects after
 *   no-cab  the cab comes out, the amp stays (power amp / an amp's FX return)
 * Runs after finishTone (so the gate and boost already sit in front of where the amp was) and
 * before sanitizeSnapshots. Idempotent: running it twice gives the same chain.
 */

const AMPS = new Set<CategoryId>(["amp-guitar", "amp-bass", "preamp"]);
const SPEAKER = new Set<CategoryId>(["cab", "mic", "ir"]);
/** With no amp to split on, these go after the loop (into the amp's FX loop). */
const LOOP_SIDE = new Set<CategoryId>(["modulation", "delay", "reverb"]);

export const FX_LOOP_MODEL = "fx-loop";

function categoryOf(b: StompBlock): CategoryId | undefined {
  return MODEL_MAP[b.modelId]?.category;
}

export function removesAmp(route: Route): boolean {
  return route === "pedals" || route === "4cm";
}

export function removesCab(route: Route): boolean {
  return route !== "full";
}

function wiringTip(preset: Preset, route: Route): string | undefined {
  if (route === "4cm") {
    const jacks = preset.stompModel === "pod-go" ? "FX Send / FX Return" : preset.stompModel.startsWith("hx-stomp") ? "Send L / Return L" : "Send 1 / Return 1";
    return `4-cable method: guitar into the unit, ${jacks} to your amp's input and FX send, unit output to the amp's FX return.`;
  }
  if (route === "pedals") return "Into the front of your amp: set the amp clean and loud enough; the pedals do the rest.";
  if (route === "no-cab") return "No cab in the file: run it into a power amp and a real guitar cab, or your amp's FX return.";
  return undefined;
}

export function applyRouting(preset: Preset, target: PlaybackTarget | undefined = preset.playbackTarget): Preset {
  const route = routeFor(target);
  const routed: Preset = target === undefined ? preset : { ...preset, playbackTarget: target };
  if (route === "full") return routed;

  const sorted = [...routed.blocks].sort((a, b) => a.position - b.position);
  const ampAt = sorted.findIndex((b) => AMPS.has(categoryOf(b) as CategoryId));
  const drop = (b: StompBlock) => {
    const c = categoryOf(b);
    if (!c) return false;
    if (SPEAKER.has(c)) return true;
    return removesAmp(route) && AMPS.has(c);
  };
  let kept = sorted.filter((b) => !drop(b));
  const removed = new Set(sorted.filter(drop).map((b) => b.id));

  let loop: StompBlock | undefined;
  const device = DEVICE_MAP[routed.stompModel];
  if (route === "4cm" && device?.fxLoopModel && MODEL_MAP[device.fxLoopModel]) {
    loop = kept.find((b) => b.modelId === device.fxLoopModel);
    if (!loop) {
      // Where the amp was; else in front of the first modulation / delay / reverb.
      let at: number;
      if (ampAt >= 0) at = sorted.slice(0, ampAt).filter((b) => !drop(b)).length;
      else {
        at = kept.findIndex((b) => LOOP_SIDE.has(categoryOf(b) as CategoryId));
        if (at < 0) at = kept.length;
      }
      loop = { id: newId("blk"), modelId: device.fxLoopModel, enabled: true, path: "main", position: at, params: {} };
      kept = [...kept.slice(0, at), loop, ...kept.slice(at)];
    }
  }
  const blocks = kept.map((b, i) => ({ ...b, position: i, ...(b === loop ? { enabled: true } : {}) }));
  if (!removed.size && !loop) return routed;

  const snapshots = routed.snapshots.map((s) => {
    const enabled = s.enabledBlocks.filter((id) => !removed.has(id));
    if (loop && !enabled.includes(loop.id)) enabled.push(loop.id);
    const paramOverrides = s.paramOverrides
      ? Object.fromEntries(Object.entries(s.paramOverrides).filter(([id]) => !removed.has(id)))
      : s.paramOverrides;
    return { ...s, enabledBlocks: enabled, paramOverrides };
  });
  const footswitches = routed.footswitches.filter((f) => !(f.action === "bypass" && f.targetBlockId && removed.has(f.targetBlockId)));
  const tip = wiringTip(routed, route);
  const tips = tip && !routed.tips.includes(tip) ? [...routed.tips, tip] : routed.tips;
  return { ...routed, blocks, snapshots, footswitches, tips };
}
