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
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_REST_THEME_GUID,
  DEFAULT_STAGE_THEME,
  DEFAULT_STAGE_THEME_GUID,
  DEFAULT_TEXT_THEME,
  DEFAULT_TEXT_THEME_GUID,
} from "./seedThemes";

const BINDINGS_KEY = "open_presenter_theme_bindings";
const STAGE_THEME_KEY = "open_presenter_stage_theme";
const STAGE_REST_THEME_KEY = "open_presenter_stage_rest_theme";

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

function loadStoredStageRestTheme(): string | null {
  try {
    return localStorage.getItem(STAGE_REST_THEME_KEY);
  } catch {
    return null;
  }
}

function persistStageRestTheme(guid: string | null): void {
  try {
    if (guid === null) localStorage.removeItem(STAGE_REST_THEME_KEY);
    else localStorage.setItem(STAGE_REST_THEME_KEY, guid);
  } catch {}
}

interface SlideThemesState {
  themes: SlideTheme[];
  bindings: ThemeBinding[];
  stageThemeGuid: string | null;
  stageRestThemeGuid: string | null;
  load(): Promise<void>;
  ensureSeeded(): Promise<void>;
  save(theme: SlideTheme): Promise<void>;
  remove(guid: string): Promise<void>;
  setBinding(target: OutputTarget, asset: SlideKind, guid: string): void;
  clearBinding(target: OutputTarget, asset: SlideKind): void;
  setStageTheme(guid: string | null): void;
  setStageRestTheme(guid: string | null): void;
  resolveTheme(
    target: OutputTarget,
    kind: SlideKind,
    customThemeId?: string | null,
  ): SlideTheme | null;
  resolveStageTheme(): SlideTheme | null;
  resolveStageRestTheme(): SlideTheme | null;
}

export const useSlideThemesStore = create<SlideThemesState>((set, get) => ({
  themes: [],
  bindings: loadStoredBindings(),
  stageThemeGuid: loadStoredStageTheme(),
  stageRestThemeGuid: loadStoredStageRestTheme(),
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
      let updated = false;
      if (
        !themes.some(
          (t) =>
            t.guid === DEFAULT_TEXT_THEME_GUID ||
            t.title.toLowerCase().includes("texto"),
        )
      ) {
        await saveTheme(DEFAULT_TEXT_THEME);
        themes = [...themes, DEFAULT_TEXT_THEME];
        updated = true;
      }
      if (
        !themes.some(
          (t) =>
            t.guid === DEFAULT_STAGE_REST_THEME_GUID ||
            t.title.toLowerCase().includes("descanso"),
        )
      ) {
        await saveTheme(DEFAULT_STAGE_REST_THEME);
        themes = [...themes, DEFAULT_STAGE_REST_THEME];
        updated = true;
      }
      if (updated) {
        set({ themes });
      }
      if (
        !get().bindings.some(
          (b) => b.target === "public" && b.asset === "custom",
        )
      ) {
        get().setBinding("public", "custom", DEFAULT_TEXT_THEME_GUID);
      }
      return;
    }
    await saveTheme(DEFAULT_MUSIC_THEME);
    await saveTheme(DEFAULT_TEXT_THEME);
    await saveTheme(DEFAULT_STAGE_THEME);
    await saveTheme(DEFAULT_STAGE_REST_THEME);
    set({
      themes: [
        DEFAULT_MUSIC_THEME,
        DEFAULT_TEXT_THEME,
        DEFAULT_STAGE_THEME,
        DEFAULT_STAGE_REST_THEME,
      ],
    });
    get().setBinding("public", "lyric", DEFAULT_MUSIC_THEME_GUID);
    get().setBinding("public", "custom", DEFAULT_TEXT_THEME_GUID);
    get().setStageTheme(DEFAULT_STAGE_THEME_GUID);
    get().setStageRestTheme(DEFAULT_STAGE_REST_THEME_GUID);
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
      const stageRestThemeGuid =
        s.stageRestThemeGuid === guid ? null : s.stageRestThemeGuid;
      if (s.stageRestThemeGuid === guid) persistStageRestTheme(null);
      return {
        themes: s.themes.filter((t) => t.guid !== guid),
        bindings,
        stageThemeGuid,
        stageRestThemeGuid,
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
  clearBinding: (target, asset) => {
    const key = bindingKey(target, asset);
    set((s) => {
      const bindings = s.bindings.filter(
        (b) => bindingKey(b.target, b.asset) !== key,
      );
      persistBindings(bindings);
      return { bindings };
    });
  },
  setStageTheme: (guid) => {
    persistStageTheme(guid);
    set({ stageThemeGuid: guid });
  },
  resolveTheme: (target, kind, customThemeId) => {
    if (customThemeId) {
      const foundCustom = get().themes.find((t) => t.guid === customThemeId);
      if (foundCustom) return foundCustom;
    }
    const binding = get().bindings.find(
      (b) => b.target === target && b.asset === kind,
    );
    if (binding) {
      const found = get().themes.find((t) => t.guid === binding.themeGuid);
      if (found) return found;
    }
    // Fallback inteligente caso não haja binding explícito
    if (kind === "custom") {
      const textTheme = get().themes.find(
        (t) =>
          t.guid === DEFAULT_TEXT_THEME_GUID ||
          t.title.toLowerCase().includes("texto") ||
          t.title.toLowerCase().includes("aviso"),
      );
      if (textTheme) return textTheme;
    } else if (kind === "lyric") {
      const musicTheme = get().themes.find(
        (t) =>
          t.guid === DEFAULT_MUSIC_THEME_GUID ||
          t.title.toLowerCase().includes("louvor") ||
          t.title.toLowerCase().includes("música"),
      );
      if (musicTheme) return musicTheme;
    }
    return get().themes[0] ?? null;
  },
  setStageRestTheme: (guid) => {
    persistStageRestTheme(guid);
    set({ stageRestThemeGuid: guid });
  },
  resolveStageTheme: () => {
    const guid = get().stageThemeGuid ?? DEFAULT_STAGE_THEME_GUID;
    const found = get().themes.find((t) => t.guid === guid);
    if (found) return found;
    const fallback = get().themes.find(
      (t) =>
        t.title.toLowerCase().includes("retorno") ||
        t.title.toLowerCase().includes("palco") ||
        t.title.toLowerCase().includes("stage"),
    );
    return fallback ?? get().themes[0] ?? DEFAULT_STAGE_THEME;
  },
  resolveStageRestTheme: () => {
    const guid = get().stageRestThemeGuid ?? DEFAULT_STAGE_REST_THEME_GUID;
    const found = get().themes.find((t) => t.guid === guid);
    if (found) return found;
    const fallback = get().themes.find(
      (t) =>
        t.title.toLowerCase().includes("descanso") ||
        t.title.toLowerCase().includes("espera") ||
        t.title.toLowerCase().includes("relogio") ||
        t.title.toLowerCase().includes("relógio"),
    );
    return fallback ?? DEFAULT_STAGE_REST_THEME;
  },
}));
