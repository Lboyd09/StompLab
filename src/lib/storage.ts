import type { Preset, StompModelId, UserGear } from "@/data/types";
import { parseStompModelId } from "@/data/types";
import { parseGuitarRole, type GuitarRole } from "./guitar-role";
import { parseWahMode, parseWahModelId, type WahMode } from "./wah";

const PRESETS_KEY = "stomplab.presets.v1";
const GEAR_KEY = "stomplab.gear.v1";
const SETTINGS_KEY = "stomplab.settings.v1";
const PALETTE_KEY = "stomplab.palette.v2";
const GEMINI_KEY = "stomplab.geminiKey.v1";
const OWNER_KEY = "stomplab.presets.owner";
const SETLISTS_KEY = "stomplab.setlists.v1";

export type ThemeId = "dark" | "light" | "system";
export type FsModePref = "auto" | "snapshot" | "stomp";

export type Settings = {
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  theme: ThemeId;
  defaultFsMode: FsModePref;
  showDsp: boolean;
  confirmDownload: boolean;
  showFsNumbers: boolean;
  largeControls: boolean;
  lcdBright: boolean;
  reduceMotion: boolean;
  wahMode: WahMode;
  wahModelId: string;
  guitarRole: GuitarRole;
  /** SL-68: the player's own cab IR slot (1–128) on the unit, or null for the stock cab. */
  irSlot: number | null;
};

/** A whole IR slot number 1–128, or null. */
export function parseIrSlot(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 128 ? n : null;
}

const DEFAULT_SETTINGS: Settings = {
  instrument: "guitar",
  stompModel: "hx-stomp",
  theme: "dark",
  defaultFsMode: "auto",
  showDsp: true,
  confirmDownload: false,
  showFsNumbers: true,
  largeControls: false,
  lcdBright: false,
  reduceMotion: false,
  wahMode: "pedal",
  wahModelId: "teardrop-310",
  guitarRole: "both",
  irSlot: null,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function storageOwnerKey(userId: string | null | undefined) {
  const id = (userId ?? "").trim();
  return id ? id : "anon";
}

function presetsKey(owner: string) {
  return `${PRESETS_KEY}.${owner}`;
}

function gearKey(owner: string) {
  return `${GEAR_KEY}.${owner}`;
}

export function loadPresets(owner = "anon"): Preset[] {
  const scoped = readJson<Preset[]>(presetsKey(owner), []);
  if (!scoped.length) return [];
  return dedupeHistory(scoped);
}

export function savePresets(presets: Preset[], owner = "anon") {
  writeJson(presetsKey(owner), presets);
}

export const HISTORY_CAP = 400;

function historyNorm(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Same song on the same unit, or the same custom name on the same unit, is one row. */
export function historyKey(preset: Preset): string {
  const song = historyNorm(preset.song);
  if (preset.source === "custom" || !song) {
    return `custom|${preset.stompModel}|${historyNorm(preset.name)}`;
  }
  return `song|${preset.stompModel}|${song}|${historyNorm(preset.artist)}`;
}

export function dedupeHistory(presets: Preset[]): Preset[] {
  const sorted = [...presets].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const seen = new Set<string>();
  const out: Preset[] = [];
  for (const preset of sorted) {
    const key = historyKey(preset);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(preset);
  }
  return out.slice(0, HISTORY_CAP);
}

export function upsertPreset(preset: Preset, owner = "anon"): Preset[] {
  const key = historyKey(preset);
  const all = loadPresets(owner).filter((p) => p.id !== preset.id && historyKey(p) !== key);
  const next = dedupeHistory([preset, ...all]);
  savePresets(next, owner);
  return next;
}

export function deletePreset(id: string, owner = "anon"): Preset[] {
  const next = loadPresets(owner).filter((p) => p.id !== id);
  savePresets(next, owner);
  return next;
}

/** Setlists are raw JSON here; `cleanSetlists` in setlist.ts shapes them. */
export function loadSetlistsRaw(owner = "anon"): unknown {
  return readJson<unknown>(`${SETLISTS_KEY}.${owner}`, []);
}

export function saveSetlistsRaw(setlists: unknown, owner = "anon") {
  try {
    writeJson(`${SETLISTS_KEY}.${owner}`, setlists);
  } catch {
    /* quota: the account copy still has them */
  }
}

export function loadGear(owner = "anon"): UserGear[] {
  return readJson<UserGear[]>(gearKey(owner), []);
}

export function saveGear(gear: UserGear[], owner = "anon") {
  writeJson(gearKey(owner), gear);
}

/** First signed-in account on this browser inherits leftover v1 history once. */
export function adoptLegacyLocal(owner: string): { presets: Preset[]; gear: UserGear[] } {
  if (typeof window === "undefined") return { presets: [], gear: [] };
  if (!owner || owner === "anon") return { presets: loadPresets("anon"), gear: loadGear("anon") };
  const already = localStorage.getItem(OWNER_KEY);
  const existing = loadPresets(owner);
  const existingGear = loadGear(owner);
  if (existing.length || existingGear.length) {
    localStorage.setItem(OWNER_KEY, owner);
    return { presets: existing, gear: existingGear };
  }
  if (already && already !== owner) {
    return { presets: [], gear: [] };
  }
  const legacy = readJson<Preset[]>(PRESETS_KEY, []);
  const legacyGear = readJson<UserGear[]>(GEAR_KEY, []);
  if (legacy.length) savePresets(legacy, owner);
  if (legacyGear.length) saveGear(legacyGear, owner);
  localStorage.setItem(OWNER_KEY, owner);
  try {
    localStorage.removeItem(PRESETS_KEY);
    localStorage.removeItem(GEAR_KEY);
  } catch {
    /* ignore */
  }
  return { presets: legacy, gear: legacyGear };
}

export function loadSettings(): Settings {
  const raw = readJson<Partial<Settings>>(SETTINGS_KEY, {});
  let theme: ThemeId =
    raw.theme === "dark" || raw.theme === "light" || raw.theme === "system" ? raw.theme : DEFAULT_SETTINGS.theme;
  try {
    if (typeof window !== "undefined" && !window.localStorage.getItem(PALETTE_KEY)) {
      window.localStorage.setItem(PALETTE_KEY, "1");
      theme = "dark";
      writeJson(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...raw, theme: "dark" });
    }
  } catch {
    /* ignore */
  }
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    theme,
    instrument: raw.instrument === "bass" ? "bass" : "guitar",
    stompModel: parseStompModelId(raw.stompModel, DEFAULT_SETTINGS.stompModel),
    wahMode: parseWahMode(raw.wahMode),
    wahModelId: parseWahModelId(raw.wahModelId),
    guitarRole: parseGuitarRole(raw.guitarRole),
    irSlot: parseIrSlot(raw.irSlot),
  };
}

export function saveSettings(settings: Settings) {
  writeJson(SETTINGS_KEY, settings);
}

export function patchSettings(partial: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...partial };
  saveSettings(next);
  return next;
}

export function loadGeminiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GEMINI_KEY) ?? "";
}

export function saveGeminiKey(key: string) {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  if (!trimmed) localStorage.removeItem(GEMINI_KEY);
  else localStorage.setItem(GEMINI_KEY, trimmed);
}
