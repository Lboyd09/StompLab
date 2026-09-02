import type { Preset, StompModelId, UserGear } from "@/data/types";
import { parseStompModelId } from "@/data/types";

const PRESETS_KEY = "stomplab.presets.v1";
const GEAR_KEY = "stomplab.gear.v1";
const SETTINGS_KEY = "stomplab.settings.v1";
const GEMINI_KEY = "stomplab.geminiKey.v1";
const OWNER_KEY = "stomplab.presets.owner";

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
};

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
  if (scoped.length) return scoped;
  return [];
}

export function savePresets(presets: Preset[], owner = "anon") {
  writeJson(presetsKey(owner), presets);
}

export function upsertPreset(preset: Preset, owner = "anon"): Preset[] {
  const all = loadPresets(owner).filter((p) => p.id !== preset.id);
  const next = [preset, ...all].slice(0, 60);
  savePresets(next, owner);
  return next;
}

export function deletePreset(id: string, owner = "anon"): Preset[] {
  const next = loadPresets(owner).filter((p) => p.id !== id);
  savePresets(next, owner);
  return next;
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
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    stompModel: parseStompModelId(raw.stompModel, DEFAULT_SETTINGS.stompModel),
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
