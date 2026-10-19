import type { Preset, StompModelId } from "@/data/types";
import { exportExtension, hlxJson } from "./hlx";
import { canDownloadPreset, featuredOriginal, newId, resolveNamedPreset, withStompModel } from "./preset-utils";
import { historyKey } from "./storage";
import { zipStore } from "./zip";

/** One song in a set. `copy` is the preset as it was when added, the fallback when History no longer has it. */
export type SetlistItem = {
  id: string;
  presetId: string;
  key: string;
  title: string;
  artist?: string;
  copy: Preset;
};

export type Setlist = {
  id: string;
  name: string;
  items: SetlistItem[];
  createdAt: number;
  updatedAt: number;
};

export const SETLIST_CAP = 30;
export const SETLIST_SONG_CAP = 20;

export function newSetlist(name: string, now = Date.now()): Setlist {
  return { id: newId("set"), name: name.trim().slice(0, 60) || "Setlist", items: [], createdAt: now, updatedAt: now };
}

export function itemFromPreset(preset: Preset): SetlistItem {
  return {
    id: newId("si"),
    presetId: preset.id,
    key: historyKey(preset),
    title: (preset.song || preset.name || "Preset").trim(),
    artist: preset.artist,
    copy: preset,
  };
}

export function addToSetlist(set: Setlist, preset: Preset, now = Date.now()): Setlist {
  if (set.items.length >= SETLIST_SONG_CAP) return set;
  return { ...set, items: [...set.items, itemFromPreset(preset)], updatedAt: now };
}

export function moveItem(set: Setlist, index: number, delta: -1 | 1, now = Date.now()): Setlist {
  const to = index + delta;
  if (index < 0 || index >= set.items.length || to < 0 || to >= set.items.length) return set;
  const items = [...set.items];
  const [item] = items.splice(index, 1);
  items.splice(to, 0, item);
  return { ...set, items, updatedAt: now };
}

export function removeItem(set: Setlist, itemId: string, now = Date.now()): Setlist {
  return { ...set, items: set.items.filter((i) => i.id !== itemId), updatedAt: now };
}

/** Newest edits first, at most SETLIST_CAP, malformed rows dropped. */
export function cleanSetlists(raw: unknown): Setlist[] {
  if (!Array.isArray(raw)) return [];
  const out: Setlist[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const set = s as Partial<Setlist>;
    if (typeof set.id !== "string" || typeof set.name !== "string" || !Array.isArray(set.items)) continue;
    const items = set.items.filter(
      (i): i is SetlistItem =>
        Boolean(i) && typeof i.id === "string" && typeof i.presetId === "string" && Boolean(i.copy) && typeof i.copy === "object",
    );
    out.push({
      id: set.id,
      name: set.name,
      items: items.slice(0, SETLIST_SONG_CAP),
      createdAt: Number(set.createdAt) || 0,
      updatedAt: Number(set.updatedAt) || 0,
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, SETLIST_CAP);
}

/**
 * The preset this song should export: the player's latest version in History
 * (by id, then by song + unit, since a rebuild gets a new id), the demo as it
 * ships, then the copy saved with the set. Always laid out for `unit`.
 */
export function resolveItem(item: SetlistItem, history: Preset[], unit: StompModelId): Preset {
  const stored = history.find((p) => p.id === item.presetId) ?? history.find((p) => historyKey(p) === item.key);
  if (stored) return withStompModel(stored, unit);
  if (featuredOriginal(item.presetId)) {
    const named = resolveNamedPreset(item.presetId, unit, history);
    if (named) return named;
  }
  return withStompModel(item.copy, unit);
}

/** File-system safe, keeps spaces and letters. */
export function safeFileTitle(raw: string): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48)
    .replace(/[. ]+$/, "");
  return cleaned || "Preset";
}

export function setlistFileName(index: number, title: string, ext: "hlx" | "pgp"): string {
  return `${String(index + 1).padStart(2, "0")} ${safeFileTitle(title)}.${ext}`;
}

export type SetlistExport = {
  zip: Uint8Array | null;
  files: string[];
  /** Songs left out, with a short reason the player can act on. */
  skipped: { title: string; reason: string }[];
};

/** One file per song, numbered in set order, each in Snapshot mode. */
export function exportSetlist(
  set: Setlist,
  history: Preset[],
  unit: StompModelId,
  plan: { paid?: boolean; admin?: boolean } | null | undefined,
  when?: Date,
): SetlistExport {
  const ext = exportExtension(unit);
  const skipped: SetlistExport["skipped"] = [];
  if (!ext) {
    return { zip: null, files: [], skipped: set.items.map((i) => ({ title: i.title, reason: "This unit does not load preset files." })) };
  }
  const entries: { name: string; data: string }[] = [];
  set.items.forEach((item, index) => {
    if (!canDownloadPreset(item.presetId, plan)) {
      skipped.push({ title: item.title, reason: "Subscribe to download this one." });
      return;
    }
    try {
      const preset = resolveItem(item, history, unit);
      entries.push({ name: setlistFileName(index, item.title, ext), data: hlxJson(preset, { fsMode: "snapshot" }) });
    } catch {
      skipped.push({ title: item.title, reason: "Could not export. Open it and download it on its own." });
    }
  });
  if (!entries.length) return { zip: null, files: [], skipped };
  return { zip: zipStore(entries, when), files: entries.map((e) => e.name), skipped };
}

export function setlistZipName(name: string): string {
  return `${safeFileTitle(name)}.zip`;
}
