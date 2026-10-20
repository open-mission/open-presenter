import { useEffect, useMemo } from "react";
import { kindToAsset } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { SlideTransition } from "@/features/presentation/SlideTransition";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useThemesSync } from "@/features/slide-themes/useThemeSync";
import { DEFAULT_STREAM_THEME } from "@/features/slide-themes/seedThemes";
import { contextForSlide } from "@/features/slide-themes/themeResolution";
import { getPageForContext, materializePage } from "@/features/slide-themes/pages";

/**
 * Saída transparente para transmissão ao vivo (OBS Studio, vMix, etc.)
 * Renderiza o slide atual (letras, escrituras bíblicas, textos, comunicados)
 * com fundo 100% transparente sobre o canvas 16:9, consumível tanto
 * via Browser Source do OBS (`/#/stream` ou `/output/stream`) quanto por NDI.
 */
export default function StreamView() {
  usePresentationSync("stream");
  useThemesSync();

  const live = usePresentationStore((s) => s.live);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.stream);

  const mediaThemeId = live.content.media?.themeId;

  // Garante que o fundo do documento fique completamente transparente para o OBS
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.backgroundColor = "transparent";
    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, []);

  useEffect(() => {
    void ensureSeeded().then(() => void loadThemes());
  }, [ensureSeeded, loadThemes]);

  const localTheme = useMemo(
    () =>
      resolveTheme(
        "stream",
        live.content.kind,
        mediaThemeId,
        live.content.media?.kind,
      ),
    [
      resolveTheme,
      themes,
      bindings,
      eventThemeGuid,
      live.content.kind,
      mediaThemeId,
      live.content.media?.kind,
    ],
  );

  // Mídia só customiza o tema da transmissão se for explicitamente tema de transmissão (Lower Third)
  const streamCustomTheme = useMemo(() => {
    if (!mediaThemeId) return null;
    const candidate = themes.find((t) => t.guid === mediaThemeId);
    return candidate?.category === "stream" ? candidate : null;
  }, [mediaThemeId, themes]);

  const rawTheme = broadcastTheme ?? streamCustomTheme ?? localTheme ?? DEFAULT_STREAM_THEME;
  const context = contextForSlide(live.content.kind, live.content.media?.kind) ?? "music";

  // Garante que o tema tenha os elementos de lower third materializados para o contexto atual
  const theme = useMemo(() => {
    const candidate = rawTheme ?? DEFAULT_STREAM_THEME;
    if (candidate.pages?.length) {
      const page = getPageForContext(candidate, context) ?? candidate.pages[0];
      return page ? materializePage(candidate, page) : candidate;
    }
    return candidate;
  }, [rawTheme, context]);

  const asset = kindToAsset(live.content.kind) ?? "music";
  const isPresenting = live.content.kind !== "blank";
  const shouldClear = live.cleared || !isPresenting;

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent select-none">
      {/* Camada de Conteúdo e Slides Transparente */}
      <div className="absolute inset-0 z-20">
        <SlideTransition
          slide={live}
          theme={theme}
          asset={asset}
          cleared={shouldClear}
          durationMs={300}
          transitionBackground={false}
        />
      </div>

      {/* Camada de Blackout com fade suave */}
      <div
        className="absolute inset-0 z-30 bg-black pointer-events-none transition-opacity duration-300 ease-in-out"
        style={{
          opacity: live.blackout ? 1 : 0,
        }}
      />
    </div>
  );
}
