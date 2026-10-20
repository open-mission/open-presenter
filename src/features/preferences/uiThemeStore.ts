import { create } from "zustand";
import {
  DEFAULT_UI_THEME,
  UI_THEME_STORAGE_KEY,
  applyUiTheme,
  cloneUiTheme,
  findPreset,
  getCurrentUiMode,
  loadUiTheme,
  saveUiTheme,
  type UiTheme,
  type UiThemeMode,
  type UiThemeTokenKey,
} from "@/core/theme/uiTheme";

interface UiThemeState {
  theme: UiTheme;
  paletteMode: UiThemeMode;
  setPaletteMode(mode: UiThemeMode): void;
  selectPreset(presetId: string): void;
  setToken(mode: UiThemeMode, key: UiThemeTokenKey, value: string): void;
  setRadius(radius: string): void;
  reset(): void;
  replaceTheme(theme: UiTheme): void;
  syncFromStorage(): void;
}

function commitTheme(theme: UiTheme): void {
  saveUiTheme(theme);
  applyUiTheme(theme, getCurrentUiMode());
}

export const useUiThemeStore = create<UiThemeState>((set) => ({
  theme: loadUiTheme(),
  paletteMode: getCurrentUiMode(),
  setPaletteMode: (paletteMode) => set({ paletteMode }),
  selectPreset: (presetId) => {
    const preset = findPreset(presetId);
    if (!preset) return;
    const theme = cloneUiTheme(preset.theme);
    commitTheme(theme);
    set({ theme });
  },
  setToken: (mode, key, value) =>
    set((state) => {
      if (!value.trim() || state.theme[mode][key] === value) return state;

      const theme = cloneUiTheme(state.theme);
      theme[mode][key] = value;
      theme.presetId = null;
      theme.name = "Personalizado";
      commitTheme(theme);
      return { theme };
    }),
  setRadius: (radius) =>
    set((state) => {
      if (!radius.trim() || state.theme.radius === radius) return state;

      const theme = cloneUiTheme(state.theme);
      theme.radius = radius;
      theme.presetId = null;
      theme.name = "Personalizado";
      commitTheme(theme);
      return { theme };
    }),
  reset: () => {
    const theme = cloneUiTheme(DEFAULT_UI_THEME);
    commitTheme(theme);
    set({ theme });
  },
  replaceTheme: (nextTheme) => {
    const theme = cloneUiTheme(nextTheme);
    commitTheme(theme);
    set({ theme, paletteMode: getCurrentUiMode() });
  },
  syncFromStorage: () => {
    set({ theme: loadUiTheme() });
  },
}));

export function initUiThemeStoreSync(): () => void {
  if (typeof window === "undefined") return () => {};

  function handleStorage(event: StorageEvent) {
    if (event.key === UI_THEME_STORAGE_KEY) {
      useUiThemeStore.getState().syncFromStorage();
    }
  }

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
