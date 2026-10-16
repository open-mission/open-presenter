import { create } from "zustand";
import type {
  OutputTarget,
  SlideKind,
  SlideTheme,
  ThemeBinding,
} from "@/core/types";
import { deleteTheme, listThemes, saveTheme } from "@/core/ipc/commands";
import {
  DEFAULT_MUSIC_THEME,
  DEFAULT_MUSIC_THEME_GUID,
  DEFAULT_STAGE_THEME,
  DEFAULT_STAGE_THEME_GUID,
} from "./seedThemes";

const BINDINGS_KEY = "open_presenter_theme_bindings";
const STAGE_THEME_KEY = "open_presenter_stage_theme";

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

function loadStoredStageTheme(): string | null {
  try {
    return localStorage.getItem(STAGE_THEME_KEY);
  } catch {
    return null;
  }
}

function persistStageTheme(guid: string | null): void {
  try {
    if (guid === null) localStorage.removeItem(STAGE_THEME_KEY);
    else localStorage.setItem(STAGE_THEME_KEY, guid);
  } catch {}
}

interface SlideThemesState {
  themes: SlideTheme[];
  bindings: ThemeBinding[];
  stageThemeGuid: string | null;
  load(): Promise<void>;
  ensureSeeded(): Promise<void>;
  save(theme: SlideTheme): Promise<void>;
  remove(guid: string): Promise<void>;
  setBinding(target: OutputTarget, asset: SlideKind, guid: string): void;
  setStageTheme(guid: string | null): void;
  resolveTheme(target: OutputTarget, kind: SlideKind): SlideTheme | null;
  resolveStageTheme(): SlideTheme | null;
}

export const useSlideThemesStore = create<SlideThemesState>((set, get) => ({
  themes: [],
  bindings: loadStoredBindings(),
  stageThemeGuid: loadStoredStageTheme(),
  load: async () => {
    try {
      set({ themes: await listThemes() });
    } catch {
      set({ themes: [] });
    }
  },
  ensureSeeded: async () => {
    let themes: SlideTheme[];
    try {
      themes = await listThemes();
    } catch {
      themes = get().themes;
    }
    if (themes.length > 0) {
      set({ themes });
      return;
    }
    await saveTheme(DEFAULT_MUSIC_THEME);
    await saveTheme(DEFAULT_STAGE_THEME);
    set({ themes: [DEFAULT_MUSIC_THEME, DEFAULT_STAGE_THEME] });
    get().setBinding("public", "lyric", DEFAULT_MUSIC_THEME_GUID);
    get().setStageTheme(DEFAULT_STAGE_THEME_GUID);
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
      const stageThemeGuid = s.stageThemeGuid === guid ? null : s.stageThemeGuid;
      if (s.stageThemeGuid === guid) persistStageTheme(null);
      return {
        themes: s.themes.filter((t) => t.guid !== guid),
        bindings,
        stageThemeGuid,
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
  setStageTheme: (guid) => {
    persistStageTheme(guid);
    set({ stageThemeGuid: guid });
  },
  resolveTheme: (target, kind) => {
    const binding = get().bindings.find(
      (b) => b.target === target && b.asset === kind,
    );
    if (!binding) return null;
    return get().themes.find((t) => t.guid === binding.themeGuid) ?? null;
  },
  resolveStageTheme: () => {
    const guid = get().stageThemeGuid;
    if (!guid) return null;
    return get().themes.find((t) => t.guid === guid) ?? null;
  },
}));
