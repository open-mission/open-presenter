import { create } from "zustand";
import type {
  OutputTarget,
  SlideKind,
  SlideTheme,
  ThemeBinding,
} from "@/core/types";
import { deleteTheme, listThemes, saveTheme } from "@/core/ipc/commands";

const BINDINGS_KEY = "open_presenter_theme_bindings";

function bindingKey(target: OutputTarget, asset: SlideKind): string {
  return `${target}:${asset}`;
}

function loadStoredBindings(): ThemeBinding[] {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is ThemeBinding =>
        typeof b === "object" &&
        b !== null &&
        "target" in b &&
        "asset" in b &&
        "themeGuid" in b,
    );
  } catch {
    return [];
  }
}

function persistBindings(bindings: ThemeBinding[]): void {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {}
}

interface SlideThemesState {
  themes: SlideTheme[];
  bindings: ThemeBinding[];
  stageThemeGuid: string | null;
  load(): Promise<void>;
  save(theme: SlideTheme): Promise<void>;
  remove(guid: string): Promise<void>;
  setBinding(target: OutputTarget, asset: SlideKind, guid: string): void;
  setStageTheme(guid: string | null): void;
  resolveTheme(target: OutputTarget, kind: SlideKind): SlideTheme | null;
}

export const useSlideThemesStore = create<SlideThemesState>((set, get) => ({
  themes: [],
  bindings: loadStoredBindings(),
  stageThemeGuid: null,
  load: async () => {
    try {
      set({ themes: await listThemes() });
    } catch {
      set({ themes: [] });
    }
  },
  save: async (theme) => {
    await saveTheme(theme);
    set((s) => ({
      themes: s.themes.some((t) => t.guid === theme.guid)
        ? s.themes.map((t) => (t.guid === theme.guid ? theme : t))
        : [...s.themes, theme],
    }));
  },
  remove: async (guid) => {
    await deleteTheme(guid);
    set((s) => {
      const bindings = s.bindings.filter((b) => b.themeGuid !== guid);
      persistBindings(bindings);
      return {
        themes: s.themes.filter((t) => t.guid !== guid),
        bindings,
        stageThemeGuid: s.stageThemeGuid === guid ? null : s.stageThemeGuid,
      };
    });
  },
  setBinding: (target, asset, guid) => {
    const key = bindingKey(target, asset);
    set((s) => {
      const bindings = [
        ...s.bindings.filter((b) => bindingKey(b.target, b.asset) !== key),
        { target, asset, themeGuid: guid },
      ];
      persistBindings(bindings);
      return { bindings };
    });
  },
  setStageTheme: (guid) => set({ stageThemeGuid: guid }),
  resolveTheme: (target, kind) => {
    const binding = get().bindings.find(
      (b) => b.target === target && b.asset === kind,
    );
    if (!binding) return null;
    return get().themes.find((t) => t.guid === binding.themeGuid) ?? null;
  },
}));
