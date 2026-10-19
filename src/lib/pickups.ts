import { MODEL_MAP } from "@/data/catalog";
import type { Preset, UserGear } from "@/data/types";

/**
 * SL-65. The preset is voiced for the record's guitar. When the player's guitar has a different
 * kind of pickup, nudge the gain and top end so it lands closer: single coils into a humbucker
 * record get a little more drive and a little less treble, actives get less drive.
 * Only obvious names are classified; anything unclear leaves the preset alone.
 */
export type PickupKind = "single-coil" | "p90" | "humbucker" | "active";

const LABEL: Record<PickupKind, string> = {
  "single-coil": "single coils",
  p90: "P-90s",
  humbucker: "humbuckers",
  active: "active pickups",
};

/** Relative output (drive) and brightness (treble) of each kind. */
const OUTPUT: Record<PickupKind, number> = { "single-coil": 0, p90: 0.3, humbucker: 0.6, active: 1.4 };
const BRIGHT: Record<PickupKind, number> = { "single-coil": 1, p90: 0.6, humbucker: 0, active: 0.2 };
const MAX_DRIVE_MOVE = 1.2;
/** finishTone's clean-by-gain-staging line. */
const CLEAN_AMP_DRIVE = 2.4;

export function classifyPickup(raw: string): PickupKind | null {
  const s = ` ${raw.toLowerCase()} `;
  if (/acoustic|acoustasonic|nylon|classical|\bcd-60/.test(s)) return null;
  if (/\bemg\b|fluence|blackouts?\b|\bactive\b/.test(s)) return "active";
  if (/\bhss\b|\bhsh\b|\bhh\/s|\bssh\b/.test(s)) return null; // mixed: depends on the position
  if (/humbucker|\bhh\b|wide ?range|filter'?tron|\bpaf\b/.test(s)) return "humbucker";
  if (/\bp-?90s?\b|soapbar|dog ?ear|les paul (junior|special|jr)|sg (junior|special)|\bes-330\b|\bcasino\b/.test(s)) return "p90";
  if (/single[- ]coils?|\bsss\b/.test(s)) return "single-coil";
  if (/telecaster deluxe|tele deluxe/.test(s)) return "humbucker";
  if (/telecaster custom|thinline/.test(s)) return null; // both pickup kinds were made under these names
  if (/strat|telecaster|\btele\b|jazzmaster|jaguar|mustang|duo-sonic|rickenbacker|danelectro/.test(s)) return "single-coil";
  if (/les paul|\bsg\b|\bes-3[34]5\b|\bes-339\b|explorer|flying v|firebird|\bprs\b|paul reed smith|ibanez (rg|jem|s\d)|jackson|\besp\b|schecter|charvel|\bevh\b|wolfgang|dean ml|gretsch/.test(s)) return "humbucker";
  return null;
}

/** The player's guitar: a pickup item in the locker wins; guitars must agree, or we skip. */
export function playerPickup(gear: UserGear[] | undefined, record?: PickupKind): { kind: PickupKind; name: string } | null {
  if (!gear?.length) return null;
  for (const g of gear.filter((g) => g.kind === "pickup")) {
    const kind = classifyPickup(`${g.name} ${g.notes}`);
    if (kind) return { kind, name: g.name };
  }
  const guitars = gear
    .filter((g) => g.kind === "guitar")
    .map((g) => ({ kind: classifyPickup(`${g.name} ${g.notes}`), name: g.name }))
    .filter((g): g is { kind: PickupKind; name: string } => g.kind !== null);
  if (!guitars.length) return null;
  // Owns a guitar like the record's: they'll grab that one (the gear tips say so).
  if (record) {
    const same = guitars.find((g) => g.kind === record);
    if (same) return same;
  }
  return guitars.every((g) => g.kind === guitars[0].kind) ? guitars[0] : null;
}

/** The record's guitar, from the researched gear list. */
export function recordPickup(preset: Preset): PickupKind | null {
  for (const g of preset.originalGear ?? []) {
    if (!/guitar|pickup/i.test(g.role) && !/guitar|pickup/i.test(g.name)) continue;
    const kind = classifyPickup(`${g.name} ${g.notes}`);
    if (kind) return kind;
  }
  return null;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function pickupOffset(player: PickupKind, record: PickupKind): { drive: number; treble: number } {
  const drive = Math.max(-MAX_DRIVE_MOVE, Math.min(MAX_DRIVE_MOVE, OUTPUT[record] - OUTPUT[player]));
  const treble = (BRIGHT[record] - BRIGHT[player]) * 0.4;
  return { drive: round1(drive), treble: round1(treble) };
}

const AMP = new Set(["amp-guitar", "preamp"]);
const BOOSTS = new Set(["kinky-boost", "deranged-master"]);

function clamp10(n: number) {
  return round1(Math.max(0, Math.min(10, n)));
}

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

/**
 * Applies the offset to the amp's Drive/Treble (block and every snapshot that sets them). With no
 * amp (a rig in front of a real amp) it goes on the drive pedals' Drive/Gain and Tone/Treble.
 * Adds one tip saying what moved and why. Generated presets only — finishTone skips the demos.
 */
export function applyPickupOffset(preset: Preset, gear: UserGear[] | undefined): Preset {
  if (preset.instrument !== "guitar") return preset;
  const record = recordPickup(preset);
  if (!record) return preset;
  const player = playerPickup(gear, record);
  if (!player || player.kind === record) return preset;
  const { drive, treble } = pickupOffset(player.kind, record);
  if (!drive && !treble) return preset;

  const amp = preset.blocks.find((b) => AMP.has(MODEL_MAP[b.modelId]?.category ?? ""));
  const targets = amp
    ? [amp]
    : preset.blocks.filter((b) => MODEL_MAP[b.modelId]?.category === "distortion" && !BOOSTS.has(b.modelId));
  if (!targets.length) return preset;
  const driveKeys = ["Drive", "Gain"];
  const trebleKeys = amp ? ["Treble"] : ["Tone", "Treble"];
  const shift = (params: Record<string, number> | undefined) => {
    if (!params) return params;
    const next = { ...params };
    // A clean amp setting (Drive 2.4 or less) keeps its drive: it must stay clean for finishTone.
    for (const k of driveKeys) {
      if (typeof next[k] !== "number" || !drive || (amp && next[k] <= CLEAN_AMP_DRIVE)) continue;
      // ...and a dirty one is not pulled down into clean.
      next[k] = clamp10(amp ? Math.max(next[k] + drive, CLEAN_AMP_DRIVE + 0.1) : next[k] + drive);
    }
    for (const k of trebleKeys) if (typeof next[k] === "number" && treble) next[k] = clamp10(next[k] + treble);
    return next;
  };
  const ids = new Set(targets.map((t) => t.id));
  const blocks = preset.blocks.map((b) => (ids.has(b.id) ? { ...b, params: shift(b.params)! } : b));
  const snapshots = preset.snapshots.map((s) =>
    s.paramOverrides
      ? {
          ...s,
          paramOverrides: Object.fromEntries(
            Object.entries(s.paramOverrides).map(([id, p]) => [id, ids.has(id) ? shift(p)! : p]),
          ),
        }
      : s,
  );
  const where = amp ? "Amp" : "Pedal";
  const moves = [drive ? `${where} drive ${signed(drive)}` : "", treble ? `treble ${signed(treble)}` : ""].filter(Boolean).join(", ");
  const tip = `Your ${player.name} has ${LABEL[player.kind]}; the record used ${LABEL[record]}. ${moves} to close the gap.`;
  return { ...preset, blocks, snapshots, tips: [...preset.tips, tip] };
}
