import type { SlideTheme, ThemeGuide } from "@/core/types";
import { LOGICAL_H, LOGICAL_W } from "./geometry.ts";

export type GuideAxis = "x" | "y";

export function clampGuidePos(
  axis: GuideAxis,
  pos: number,
  width = LOGICAL_W,
  height = LOGICAL_H,
): number {
  const max = axis === "x" ? width : height;
  return Math.min(Math.max(pos, 0), max);
}

export function guidesOfTheme(theme: SlideTheme, pageId: string | null): ThemeGuide[] {
  if (pageId) {
    const page = theme.pages?.find((item) => item.id === pageId);
    if (page) return page.guides ?? [];
  }
  return theme.guides ?? [];
}

export function updateGuidesInTheme(
  theme: SlideTheme,
  pageId: string | null,
  updater: (guides: ThemeGuide[]) => ThemeGuide[],
): SlideTheme {
  if (pageId) {
    if (!theme.pages?.length) return theme;
    const index = theme.pages.findIndex((page) => page.id === pageId);
    if (index < 0) return theme;
    return {
      ...theme,
      pages: theme.pages.map((page, current) =>
        current === index ? { ...page, guides: updater(page.guides ?? []) } : page,
      ),
    };
  }
  return { ...theme, guides: updater(theme.guides ?? []) };
}

export function addGuideToTheme(
  theme: SlideTheme,
  pageId: string | null,
  guide: ThemeGuide,
): SlideTheme {
  const clamped: ThemeGuide = {
    ...guide,
    pos: clampGuidePos(guide.axis, guide.pos),
  };
  return updateGuidesInTheme(theme, pageId, (guides) => [
    ...guides.filter((item) => item.id !== clamped.id),
    clamped,
  ]);
}

export function moveGuideInTheme(
  theme: SlideTheme,
  pageId: string | null,
  id: string,
  pos: number,
): SlideTheme {
  const guide = guidesOfTheme(theme, pageId).find((item) => item.id === id);
  if (!guide) return theme;
  return updateGuidesInTheme(theme, pageId, (guides) =>
    guides.map((item) =>
      item.id === id ? { ...item, pos: clampGuidePos(item.axis, pos) } : item,
    ),
  );
}

export function removeGuideFromTheme(
  theme: SlideTheme,
  pageId: string | null,
  id: string,
): SlideTheme {
  return updateGuidesInTheme(theme, pageId, (guides) =>
    guides.filter((item) => item.id !== id),
  );
}

export function clearGuidesInTheme(
  theme: SlideTheme,
  pageId: string | null,
): SlideTheme {
  return updateGuidesInTheme(theme, pageId, () => []);
}

export function snapGuidePosition(
  pos: number,
  targets: readonly number[],
  threshold = 6,
): number | null {
  let best: number | null = null;
  let bestDistance = threshold;
  for (const target of targets) {
    const distance = Math.abs(target - pos);
    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}
