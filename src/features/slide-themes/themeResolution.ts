import type {
  MediaKind,
  SlideKind,
  SlideTheme,
  ThemeAsset,
  ThemeContext,
} from "@/core/types";
import { contextToAsset, getPageForContext, materializePage } from "./pages.ts";

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
    case "rest":
      return "blank";
  }
}

export function contextForStage(
  kind: SlideKind,
  mediaKind?: MediaKind | null,
): ThemeContext {
  return contextForSlide(kind, mediaKind) ?? "rest";
}

export interface StageRenderTheme {
  theme: SlideTheme;
  asset: ThemeAsset;
}

export function resolveStageRenderTheme(
  theme: SlideTheme | null | undefined,
  kind: SlideKind,
  mediaKind?: MediaKind | null,
  fallback?: SlideTheme | null,
): StageRenderTheme | null {
  const context = contextForStage(kind, mediaKind);
  return resolveRenderPage(theme, context, fallback);
}

export function resolveStageRestRenderTheme(
  theme: SlideTheme | null | undefined,
  fallback: SlideTheme,
): StageRenderTheme {
  if (theme?.pages?.length) {
    const page = getPageForContext(theme, "rest");
    if (page) return { theme: materializePage(theme, page), asset: "rest" };
  }
  return { theme: fallback, asset: "rest" };
}

function resolveRenderPage(
  theme: SlideTheme | null | undefined,
  context: ThemeContext,
  fallback?: SlideTheme | null,
): StageRenderTheme | null {
  if (!theme) {
    return fallback ? resolveRenderPage(fallback, context, null) : null;
  }
  if (!theme.pages?.length) {
    return { theme, asset: contextToAsset(context) };
  }
  const page = getPageForContext(theme, context);
  if (page) return { theme: materializePage(theme, page), asset: contextToAsset(page.context) };
  return fallback ? resolveRenderPage(fallback, context, null) : null;
}
