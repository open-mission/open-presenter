import { create } from "zustand";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/core/theme/theme";
import { isTauri } from "@/core/ipc/tauri";
import { closePreferencesWindow, openPreferencesWindow } from "@/core/ipc/commands";
import type { PreferencesTab } from "./types";

interface PreferencesState {
  isOpen: boolean;
  activeTab: PreferencesTab;
  theme: ThemeMode;
  openPreferences(tab?: PreferencesTab): void;
  closePreferences(): void;
  setTab(tab: PreferencesTab): void;
  setTheme(theme: ThemeMode): void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  isOpen: false,
  activeTab: "appearance",
  theme: getStoredTheme(),
  openPreferences: (tab) => {
    if (tab) {
      try {
        localStorage.setItem("open_presenter_pref_tab", tab);
      } catch {}
    }
    if (isTauri()) {
      set((state) => ({
        activeTab: tab ?? state.activeTab,
      }));
      void openPreferencesWindow();
    } else {
      set((state) => ({
        isOpen: true,
        activeTab: tab ?? state.activeTab,
      }));
    }
  },
  closePreferences: () => {
    if (isTauri()) {
      void closePreferencesWindow();
    }
    set({ isOpen: false });
  },
  setTab: (activeTab) => {
    try {
      localStorage.setItem("open_presenter_pref_tab", activeTab);
    } catch {}
    set({ activeTab });
  },
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
