import type { Preset, StompModelId, UserGear } from "@/data/types";

const PRESETS_KEY = "stomplab.presets.v1";
const GEAR_KEY = "stomplab.gear.v1";
const SETTINGS_KEY = "stomplab.settings.v1";
const GEMINI_KEY = "stomplab.geminiKey.v1";

export type Settings = {
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
};

const DEFAULT_SETTINGS: Settings = {
  instrument: "guitar",
  stompModel: "hx-stomp",
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

export function loadPresets(): Preset[] {
  return readJson<Preset[]>(PRESETS_KEY, []);
}

export function savePresets(presets: Preset[]) {
  writeJson(PRESETS_KEY, presets);
}

export function upsertPreset(preset: Preset): Preset[] {
  const all = loadPresets().filter((p) => p.id !== preset.id);
  const next = [preset, ...all].slice(0, 60);
  savePresets(next);
  return next;
}

export function deletePreset(id: string): Preset[] {
  const next = loadPresets().filter((p) => p.id !== id);
  savePresets(next);
  return next;
}

export function loadGear(): UserGear[] {
  return readJson<UserGear[]>(GEAR_KEY, []);
}

export function saveGear(gear: UserGear[]) {
  writeJson(GEAR_KEY, gear);
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(settings: Settings) {
  writeJson(SETTINGS_KEY, settings);
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
