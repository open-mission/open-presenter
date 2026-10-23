import { useCallback } from "react";
import type { SlideContent, SlideTheme } from "@/core/types";
import { getPageForContext, materializePage } from "./pages";
import { contextForSlide } from "./themeResolution";
import { useSlideThemesStore } from "./store";
import { useOutputThemeDocument } from "./useOutputPlan";

export type PublicThemeResolver = (
  content: SlideContent | null,
) => SlideTheme | null;

/**
 * Tema que a saída pública mostra para um slide. O plano da saída já resolve
 * override > evento > padrão; aqui só aplicamos o tema do conteúdo (mídia) e
 * materializamos a página do contexto.
 */
export function usePublicThemeResolver(): PublicThemeResolver {
  const themes = useSlideThemesStore((s) => s.themes);
  const outputTheme = useOutputThemeDocument("public");

  return useCallback(
    (content) => {
      if (!content) return null;
      const context =
        contextForSlide(content.kind, content.media?.kind) ?? "music";
      const base = content.media?.themeId
        ? (themes.find((t) => t.guid === content.media?.themeId) ?? outputTheme)
        : outputTheme;
      if (base?.pages?.length) {
        if (base.category === "presentation") {
          const slideIndex = content.media?.index ?? 0;
          const page = base.pages[slideIndex] ?? base.pages[0];
          return page ? materializePage(base, page) : base;
        }
        const page = getPageForContext(base, context) ?? base.pages[0];
        return page ? materializePage(base, page) : base;
      }
      return base;
    },
    [themes, outputTheme],
  );
}
