import { create } from "zustand";
import type { Preset, StompModelId, UserGear } from "@/data/types";
import {
  deletePreset,
  loadGear,
  loadGeminiKey,
  loadPresets,
  loadSettings,
  saveGear,
  saveGeminiKey,
  saveSettings,
  upsertPreset,
} from "@/lib/storage";

type LcdView = "play" | "edit" | "tuner";
type FsMode = "stomp" | "snapshot" | "preset";

type AppState = {
  hydrated: boolean;
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  geminiKey: string;
  presets: Preset[];
  gear: UserGear[];
  selectedBlockId: string | null;
  lcdView: LcdView;
  fsMode: FsMode;
  paramPage: number;
  activeSnapshot: number;
  hydrate: () => void;
  setInstrument: (instrument: "guitar" | "bass") => void;
  setStompModel: (stompModel: StompModelId) => void;
  setGeminiKey: (key: string) => void;
  savePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  setGear: (gear: UserGear[]) => void;
  addGear: (item: UserGear) => void;
  removeGear: (id: string) => void;
  selectBlock: (id: string | null) => void;
  setLcdView: (view: LcdView) => void;
  setFsMode: (mode: FsMode) => void;
  setParamPage: (page: number) => void;
  setActiveSnapshot: (index: number) => void;
  patchCurrent: (preset: Preset) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  instrument: "guitar",
  stompModel: "hx-stomp",
  geminiKey: "",
  presets: [],
  gear: [],
  selectedBlockId: null,
  lcdView: "play",
  fsMode: "stomp",
  paramPage: 0,
  activeSnapshot: 0,
  hydrate: () => {
    if (get().hydrated) return;
    const settings = loadSettings();
    set({
      hydrated: true,
      instrument: settings.instrument,
      stompModel: settings.stompModel,
      geminiKey: loadGeminiKey(),
      presets: loadPresets(),
      gear: loadGear(),
    });
  },
  setInstrument: (instrument) => {
    set({ instrument });
    saveSettings({ instrument, stompModel: get().stompModel });
  },
  setStompModel: (stompModel) => {
    set({ stompModel });
    saveSettings({ instrument: get().instrument, stompModel });
  },
  setGeminiKey: (geminiKey) => {
    saveGeminiKey(geminiKey);
    set({ geminiKey });
  },
  savePreset: (preset) => set({ presets: upsertPreset(preset) }),
  removePreset: (id) => set({ presets: deletePreset(id) }),
  setGear: (gear) => {
    saveGear(gear);
    set({ gear });
  },
  addGear: (item) => {
    const gear = [item, ...get().gear];
    saveGear(gear);
    set({ gear });
  },
  removeGear: (id) => {
    const gear = get().gear.filter((g) => g.id !== id);
    saveGear(gear);
    set({ gear });
  },
  selectBlock: (id) => set({ selectedBlockId: id, lcdView: id ? "edit" : "play", paramPage: 0 }),
  setLcdView: (lcdView) => set({ lcdView }),
  setFsMode: (fsMode) => set({ fsMode }),
  setParamPage: (paramPage) => set({ paramPage }),
  setActiveSnapshot: (activeSnapshot) => set({ activeSnapshot }),
  patchCurrent: (preset) => set({ presets: upsertPreset(preset) }),
}));
