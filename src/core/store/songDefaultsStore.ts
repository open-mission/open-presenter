import { create } from "zustand";
import { getSongDefaults, setSongDefaults } from "../ipc/commands";
import { isTauri } from "../ipc/tauri";
import type { LinesPerSlide, SongDefaults } from "../types";

interface SongDefaultsState {
  linesPerSlide: LinesPerSlide;
  addEmptySlideAtStart: boolean;
  vagalumeEnabled: boolean;
  holyricsEnabled: boolean;
  lrclibEnabled: boolean;
  vagalumeApiKey: string | null;
  loaded: boolean;
  loading: boolean;
  load(): Promise<void>;
  update(patch: Partial<SongDefaults>): Promise<SongDefaults>;
}

const DEFAULTS: SongDefaults = {
  linesPerSlide: "2",
  addEmptySlideAtStart: false,
  vagalumeEnabled: true,
  holyricsEnabled: true,
  lrclibEnabled: true,
  vagalumeApiKey: null,
};

export const useSongDefaultsStore = create<SongDefaultsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return;
    if (!isTauri()) {
      set({ loaded: true });
      return;
    }
    set({ loading: true });
    try {
      const defaults = await getSongDefaults();
      set({ ...defaults, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  update: async (patch) => {
    const current = get();
    const defaults = await setSongDefaults({
      linesPerSlide: current.linesPerSlide,
      addEmptySlideAtStart: current.addEmptySlideAtStart,
      vagalumeEnabled: current.vagalumeEnabled,
      holyricsEnabled: current.holyricsEnabled,
      lrclibEnabled: current.lrclibEnabled,
      vagalumeApiKey: current.vagalumeApiKey,
      ...patch,
    });
    set({ ...defaults, loaded: true });
    return defaults;
  },
}));
