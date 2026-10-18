import { create } from "zustand";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/core/theme/theme";
import { isTauri } from "@/core/ipc/tauri";
import { closePreferencesWindow, openPreferencesWindow } from "@/core/ipc/commands";
import type { OutputsSection, PreferencesTab } from "./types";

interface PreferencesState {
  isOpen: boolean;
  activeTab: PreferencesTab;
  outputsSection: OutputsSection;
  theme: ThemeMode;
  openPreferences(tab?: PreferencesTab, section?: OutputsSection): void;
  closePreferences(): void;
  setTab(tab: PreferencesTab): void;
  setOutputsSection(section: OutputsSection): void;
  setTheme(theme: ThemeMode): void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  isOpen: false,
  activeTab: "general",
  outputsSection: "public",
  theme: getStoredTheme(),
  openPreferences: (tab, section) => {
    if (tab) {
      try {
        localStorage.setItem("open_presenter_pref_tab", tab);
      } catch {}
    }
    if (section) {
      try {
        localStorage.setItem("open_presenter_outputs_section", section);
      } catch {}
    }
    if (isTauri()) {
      set((state) => ({
        activeTab: tab ?? state.activeTab,
        outputsSection: section ?? state.outputsSection,
      }));
      void openPreferencesWindow();
    } else {
      set((state) => ({
        isOpen: true,
        activeTab: tab ?? state.activeTab,
        outputsSection: section ?? state.outputsSection,
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
  setOutputsSection: (outputsSection) => {
    try {
      localStorage.setItem("open_presenter_outputs_section", outputsSection);
    } catch {}
    set({ outputsSection });
  },
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
