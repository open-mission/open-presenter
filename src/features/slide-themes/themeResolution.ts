import type {
  MediaKind,
  OutputTarget,
  SlideKind,
  SlideTheme,
  ThemeBinding,
  ThemeContext,
} from "@/core/types";
import { materializePage } from "./pages.ts";

export interface ResolveLiveThemeInput {
  kind: SlideKind;
  mediaKind?: MediaKind | null;
  mediaThemeId?: string | null;
  eventThemeGuid?: string | null;
  themes: readonly SlideTheme[];
  bindings: readonly ThemeBinding[];
  target?: OutputTarget;
  defaultTheme?: SlideTheme | null;
}

export function contextForSlide(
  kind: SlideKind,
  mediaKind?: MediaKind | null,
): ThemeContext | null {
  switch (kind) {
    case "lyric":
      return "music";
    case "scripture":
      return "bible";
    case "custom":
      return "text";
    case "media":
      return mediaKind === "text" ? "text" : null;
    case "blank":
      return null;
  }
}

export function contextToKind(context: ThemeContext): SlideKind {
  switch (context) {
    case "music":
      return "lyric";
    case "bible":
      return "scripture";
    case "text":
      return "custom";
  }
}

function findByGuid(
  themes: readonly SlideTheme[],
  guid: string | null | undefined,
): SlideTheme | null {
  if (!guid) return null;
  return themes.find((theme) => theme.guid === guid) ?? null;
}

export function resolveThemePage(
  theme: SlideTheme | null | undefined,
  context: ThemeContext,
): SlideTheme | null {
  if (!theme) return null;
  if (!theme.pages?.length) {
    if (theme.category === "stage" || theme.category === "presentation") return null;
    return theme;
  }
  const page = theme.pages.find((candidate) => candidate.context === context);
  return page ? materializePage(theme, page) : null;
}

export function resolveLiveTheme(input: ResolveLiveThemeInput): SlideTheme | null {
  const context = contextForSlide(input.kind, input.mediaKind);

  const mediaTheme = findByGuid(input.themes, input.mediaThemeId);
  if (mediaTheme) {
    if (mediaTheme.category === "presentation" || !mediaTheme.pages?.length) return mediaTheme;
    return context ? resolveThemePage(mediaTheme, context) : null;
  }

  if (!context || input.kind === "media" || input.kind === "blank") return null;

  const eventTheme = findByGuid(input.themes, input.eventThemeGuid);
  const eventResolved = resolveThemePage(eventTheme, context);
  if (eventResolved) return eventResolved;

  const target = input.target ?? "public";
  const bindingKind = contextToKind(context);
  const binding = input.bindings.find(
    (candidate) => candidate.target === target && candidate.asset === bindingKind,
  );
  const boundTheme = findByGuid(input.themes, binding?.themeGuid);
  const boundResolved = resolveThemePage(boundTheme, context);
  if (boundResolved) return boundResolved;

  return resolveThemePage(input.defaultTheme ?? null, context);
}
