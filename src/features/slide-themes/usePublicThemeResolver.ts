import { useCallback } from "react";
import type { SlideContent, SlideTheme } from "@/core/types";
import { getPageForContext, materializePage } from "./pages";
import { contextForSlide } from "./themeResolution";
import { useSlideThemesStore } from "./store";

export type PublicThemeResolver = (
  content: SlideContent | null,
) => SlideTheme | null;

export function usePublicThemeResolver(): PublicThemeResolver {
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);

  return useCallback(
    (content) => {
      if (!content) return null;
      const context =
        contextForSlide(content.kind, content.media?.kind) ?? "music";
      let base = content.media?.themeId
        ? themes.find((t) => t.guid === content.media?.themeId) ?? null
        : null;
      if (!base) {
        base = resolveTheme(
          "public",
          content.kind,
          content.media?.themeId,
          content.media?.kind,
        );
      }
      if (base?.pages?.length) {
        const page = getPageForContext(base, context) ?? base.pages[0];
        return page ? materializePage(base, page) : base;
      }
      return base;
    },
    [themes, bindings, eventThemeGuid, resolveTheme],
  );
}
