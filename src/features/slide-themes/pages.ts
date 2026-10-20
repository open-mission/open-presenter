import type {
  SlideTheme,
  ThemeAsset,
  ThemeContext,
  ThemeElement,
  ThemePage,
} from "@/core/types";

export interface PageContextInfo {
  context: ThemeContext;
  label: string;
  asset: ThemeAsset;
}

export const PUBLIC_PAGE_CONTEXTS: readonly PageContextInfo[] = [
  { context: "music", label: "Música", asset: "music" },
  { context: "bible", label: "Bíblia", asset: "bible" },
  { context: "text", label: "Texto", asset: "text" },
];

export const STAGE_PAGE_CONTEXTS: readonly PageContextInfo[] = [
  { context: "rest", label: "Descanso", asset: "rest" },
  { context: "music", label: "Música", asset: "music" },
  { context: "bible", label: "Bíblia", asset: "bible" },
  { context: "text", label: "Texto", asset: "text" },
];

export function pageContextsForCategory(
  category: SlideTheme["category"],
): readonly PageContextInfo[] {
  return category === "stage" ? STAGE_PAGE_CONTEXTS : PUBLIC_PAGE_CONTEXTS;
}

export function pageContextsForTheme(theme: SlideTheme): readonly PageContextInfo[] {
  return pageContextsForCategory(theme.category);
}

export function contextToAsset(context: ThemeContext): ThemeAsset {
  switch (context) {
    case "music":
      return "music";
    case "bible":
      return "bible";
    case "text":
      return "text";
    case "rest":
      return "rest";
  }
}

export function assetToContext(asset: ThemeAsset): ThemeContext {
  switch (asset) {
    case "music":
      return "music";
    case "bible":
      return "bible";
    case "text":
      return "text";
    case "rest":
      return "rest";
  }
}

export function getPageForContext(theme: SlideTheme, context: ThemeContext): ThemePage | null {
  return theme.pages?.find((page) => page.context === context) ?? null;
}

export function getActivePage(
  theme: SlideTheme | null,
  activePageId: string | null,
): ThemePage | null {
  if (!theme?.pages?.length) return null;
  return theme.pages.find((page) => page.id === activePageId) ?? theme.pages[0];
}

export function materializePage(theme: SlideTheme, page: ThemePage): SlideTheme {
  return { ...theme, css: page.css, elements: page.elements };
}

export function previewTheme(
  theme: SlideTheme,
  asset: ThemeAsset,
): { theme: SlideTheme; asset: ThemeAsset } {
  if (theme.pages?.length) {
    const page = getPageForContext(theme, assetToContext(asset)) ?? theme.pages[0];
    return { theme: materializePage(theme, page), asset: contextToAsset(page.context) };
  }
  return { theme, asset };
}

export type ThemeVersion = "v1" | "v2" | "single";

export function themeVersion(theme: SlideTheme): ThemeVersion {
  if (theme.category === "presentation") return "single";
  if (theme.pages?.length) return "v2";
  return theme.category === "stage" ? "single" : "v1";
}

export function isPublicTheme(theme: SlideTheme): boolean {
  return (
    theme.category !== "stage" &&
    theme.category !== "presentation" &&
    theme.category !== "stream"
  );
}

export function isStageTheme(theme: SlideTheme): boolean {
  return theme.category === "stage";
}

export function isStageCandidate(theme: SlideTheme): boolean {
  return theme.category !== "presentation" && theme.category !== "stream";
}

export function isStreamTheme(theme: SlideTheme): boolean {
  return theme.category === "stream";
}

export function isStreamCandidate(theme: SlideTheme): boolean {
  return (
    theme.category === "stream" ||
    (theme.category !== "stage" && theme.category !== "presentation")
  );
}

export function isSingleLayout(theme: SlideTheme): boolean {
  return !theme.pages?.length;
}

export function themeCoverage(theme: SlideTheme): ThemeContext[] {
  return theme.pages?.map((page) => page.context) ?? [];
}

export function themeCoverageLabel(theme: SlideTheme): string {
  const contexts = themeCoverage(theme);
  if (contexts.length === 0) return "Layout único";
  const available = pageContextsForTheme(theme);
  if (contexts.length >= available.length) {
    if (theme.category === "stage") return "4 momentos";
    if (theme.category === "stream") return "3 momentos (OBS)";
    return "3 contextos";
  }
  return available
    .filter((info) => contexts.includes(info.context))
    .map((info) => info.label)
    .join(" · ");
}

export function themeElements(theme: SlideTheme): ThemeElement[] {
  if (!theme.pages?.length) return theme.elements;
  return theme.pages.flatMap((page) => page.elements);
}

export function createPage(
  theme: SlideTheme,
  context: ThemeContext,
  mode: "duplicate" | "blank",
  sourcePage: ThemePage | null,
): ThemePage {
  if (mode === "blank") {
    return { id: crypto.randomUUID(), context, css: { background: "#000000" }, elements: [] };
  }
  const sourceCss = sourcePage?.css ?? theme.css;
  const sourceElements = sourcePage?.elements ?? theme.elements;
  return {
    id: crypto.randomUUID(),
    context,
    css: { ...sourceCss },
    elements: sourceElements.map((element) => ({
      ...structuredClone(element),
      id: crypto.randomUUID(),
    })),
  };
}

export function cloneTheme(theme: SlideTheme, title = `${theme.title} (Cópia)`): SlideTheme {
  const now = new Date().toISOString();
  const cloned = structuredClone(theme);
  cloned.guid = crypto.randomUUID();
  cloned.title = title;
  cloned.category = theme.category ?? "theme";
  cloned.createdAt = now;
  cloned.updatedAt = now;
  cloned.elements = cloned.elements.map((element) => ({ ...element, id: crypto.randomUUID() }));
  cloned.pages = cloned.pages?.map((page) => ({
    ...page,
    id: crypto.randomUUID(),
    elements: page.elements.map((element) => ({ ...element, id: crypto.randomUUID() })),
  }));
  return cloned;
}
