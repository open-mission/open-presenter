import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useDisplaysStore } from "@/features/displays/store";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";
import {
  StageAlertBanner,
  StageAlertOverlay,
  useCommunicationStore,
  useCommunicationSync,
} from "@/features/communication";

/**
 * Saída transparente para transmissão ao vivo (OBS Studio, vMix, etc.)
 * Renderiza o slide atual (letras, escrituras bíblicas, textos, comunicados)
 * sobre o canvas 16:9, consumível via Browser Source do OBS (`/#/stream` ou `/output/stream`).
 */
interface StreamViewProps {
  backgroundColor?: string;
  outputId?: string;
}

export default function StreamView({ backgroundColor, outputId }: StreamViewProps = {}) {
  usePresentationSync("stream");
  useThemesSync();
  useCommunicationSync();
  useDisplaysSync();

  const [searchParams] = useSearchParams();
  const effectiveOutputId = outputId ?? searchParams.get("id");
  const outputs = useDisplaysStore((s) => s.outputs);

  const activeOutput = useMemo(() => {
    if (effectiveOutputId) return outputs.find((o) => o.id === effectiveOutputId);
    return (
      outputs.find((o) => o.category === "lower" && o.enabled) ??
      outputs.find((o) => o.category === "lower") ??
      null
    );
  }, [outputs, effectiveOutputId]);

  const screenBg =
    backgroundColor ??
    (activeOutput?.backgroundColorEnabled ? activeOutput.backgroundColor : "transparent");

  const live = usePresentationStore((s) => s.live);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.stream);

  const mediaThemeId = live.content.media?.themeId;

  // Garante que o fundo do documento fique completamente transparente para o OBS (salvo se cor de tela customizada)
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    if (!activeOutput?.backgroundColorEnabled) {
      document.body.style.backgroundColor = "transparent";
      document.documentElement.style.backgroundColor = "transparent";
    }
    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, [activeOutput?.backgroundColorEnabled]);

  useEffect(() => {
    void ensureSeeded().then(() => void loadThemes());
  }, [ensureSeeded, loadThemes]);

  const defaultTheme = useMemo(() => {
    if (!activeOutput?.defaultThemeGuid) return null;
    return themes.find((t) => t.guid === activeOutput.defaultThemeGuid) ?? null;
  }, [themes, activeOutput?.defaultThemeGuid]);

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

  const rawTheme = streamCustomTheme ?? defaultTheme ?? broadcastTheme ?? localTheme ?? DEFAULT_STREAM_THEME;
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

  const isTargeted = Boolean(
    activeAlert &&
      (activeAlert.targets?.length
        ? activeAlert.targets.includes("stream")
        : activeAlert.target === "stream"),
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      style={{ backgroundColor: screenBg }}
    >
      {/* Camada de Conteúdo e Slides Transparente */}
      <div className="absolute inset-0 z-20">
        <SlideTransition
          slide={live}
          theme={theme}
          asset={asset}
          cleared={shouldClear}
          textHidden={live.textHidden}
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

      {/* Painel de Comunicação & Avisos: Banner Superior */}
      {isTargeted && activeAlert && activeAlert.displayMode === "banner_top" && (
        <StageAlertBanner position="top" alert={activeAlert} />
      )}

      {/* Painel de Comunicação & Avisos: Banner Inferior */}
      {isTargeted && activeAlert && activeAlert.displayMode === "banner_bottom" && (
        <StageAlertBanner position="bottom" alert={activeAlert} />
      )}

      {/* Painel de Comunicação & Avisos: Tela Cheia / Overlay */}
      {isTargeted && activeAlert && activeAlert.displayMode === "overlay" && (
        <StageAlertOverlay alert={activeAlert} />
      )}
    </div>
  );
}
