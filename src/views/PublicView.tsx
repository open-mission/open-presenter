import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { kindToAsset, type BackgroundLayer } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { PersistentBackground } from "@/features/media-shaders/PersistentBackground";
import { SlideTransition } from "@/features/presentation/SlideTransition";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useWallpaperSync } from "@/features/presentation/useWallpaperSync";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";
import { wallpaperToBackground } from "@/features/presentation/wallpaper";
import { isIsfBackground } from "@/features/media-shaders/isfEngine";
import { useDisplaysStore } from "@/features/displays/store";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";
import { OutputPlaceholder } from "@/features/displays/components/OutputPlaceholder";

import { useThemesSync } from "@/features/slide-themes/useThemeSync";
import { contextForSlide } from "@/features/slide-themes/themeResolution";
import { getPageForContext, materializePage } from "@/features/slide-themes/pages";
import {
  StageAlertBanner,
  StageAlertOverlay,
  useCommunicationStore,
  useCommunicationSync,
} from "@/features/communication";

interface PublicViewProps {
  backgroundColor?: string;
  outputId?: string;
}

export default function PublicView({ backgroundColor, outputId }: PublicViewProps = {}) {
  usePresentationSync("public");
  useWallpaperSync();
  useThemesSync();
  useCommunicationSync();
  useDisplaysSync();

  const [searchParams] = useSearchParams();
  const effectiveOutputId = outputId ?? searchParams.get("id");
  const outputs = useDisplaysStore((s) => s.outputs);

  const activeOutput = useMemo(() => {
    if (effectiveOutputId) return outputs.find((o) => o.id === effectiveOutputId);
    return (
      outputs.find((o) => o.category === "public" && o.enabled) ??
      outputs.find((o) => o.category === "public") ??
      null
    );
  }, [outputs, effectiveOutputId]);

  const screenBg =
    backgroundColor ??
    (activeOutput?.backgroundColorEnabled ? activeOutput.backgroundColor : "#000000");

  const live = usePresentationStore((s) => s.live);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const isTargeted = Boolean(
    activeAlert &&
      (activeAlert.targets?.length
        ? activeAlert.targets.includes("public")
        : activeAlert.target === "public"),
  );
  const loadThemes = useSlideThemesStore((s) => s.load);
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.public);
  const mediaThemeId = live.content.media?.themeId;

  const defaultTheme = useMemo(() => {
    if (!activeOutput?.defaultThemeGuid) return null;
    return themes.find((t) => t.guid === activeOutput.defaultThemeGuid) ?? null;
  }, [themes, activeOutput?.defaultThemeGuid]);

  const localTheme = useMemo(
    () =>
      resolveTheme(
        "public",
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
  const customTheme = mediaThemeId
    ? (themes.find((t) => t.guid === mediaThemeId) ??
       (broadcastTheme?.guid === mediaThemeId ? broadcastTheme : null))
    : null;
  const rawTheme = customTheme ?? broadcastTheme ?? defaultTheme ?? localTheme;
  const context =
    contextForSlide(live.content.kind, live.content.media?.kind) ?? "music";
  const theme = useMemo(() => {
    if (!rawTheme) return null;
    if (rawTheme.pages?.length) {
      if (rawTheme.category === "presentation") {
        const slideIndex = live.content.media?.index ?? 0;
        const page = rawTheme.pages[slideIndex] ?? rawTheme.pages[0];
        return page ? materializePage(rawTheme, page) : rawTheme;
      }
      const page = getPageForContext(rawTheme, context) ?? rawTheme.pages[0];
      return page ? materializePage(rawTheme, page) : rawTheme;
    }
    return rawTheme;
  }, [rawTheme, context, live.content.media?.index]);

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const asset = kindToAsset(live.content.kind);
  const isPresenting = live.content.kind !== "blank";

  // Prepara o papel de parede se definido
  const wallpaperBg: BackgroundLayer | null = wallpaper
    ? wallpaperToBackground(wallpaper)
    : null;

  // Resolve o plano de fundo efetivo do slide/tema
  const effectiveBackground: BackgroundLayer = useMemo(() => {
    const isPresentation = Boolean(live.content.media?.themeId);

    // Se for uma apresentação criada no Studio, seu fundo tem prioridade absoluta sobre fundos residuais de músicas
    if (isPresentation && theme?.css.background && theme.css.background.trim() !== "") {
      const bg = theme.css.background.trim();
      const isISF = isIsfBackground(bg);
      return {
        id: `theme-bg-${theme.guid}`,
        kind: isISF ? "isf" : "css",
        value: bg,
      };
    }

    const isCustomLiveBg =
      live.background.kind !== "color" ||
      (live.background.value && live.background.value !== "#000000");

    if (isCustomLiveBg) {
      if (live.background.kind === "isf" || isIsfBackground(live.background.value)) {
        return {
          id: live.background.id,
          kind: "isf",
          value: live.background.value,
        };
      }
      return live.background;
    }

    if (theme?.css.background && theme.css.background.trim() !== "") {
      const bg = theme.css.background.trim();
      const isISF = isIsfBackground(bg);
      return {
        id: `theme-bg-${theme.guid}`,
        kind: isISF ? "isf" : "css",
        value: bg,
      };
    }

    return live.background;
  }, [live.background, theme, live.content.media?.themeId]);

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      style={{ backgroundColor: screenBg }}
    >
      {/* Camada 0: Papel de Parede / Placeholder (Base) */}
      {activeOutput?.placeholderEnabled && activeOutput.placeholderType !== "none" ? (
        <div className="absolute inset-0 z-0">
          <OutputPlaceholder output={activeOutput} />
        </div>
      ) : wallpaperBg ? (
        <div className="absolute inset-0 z-0">
          <BackgroundRenderer background={wallpaperBg} />
        </div>
      ) : null}

      {/* Camada 1: Plano de Fundo Persistente (mantido estável durante a transição dos slides) */}
      {isPresenting && (
        <div
          className="absolute inset-0 z-10 transition-opacity duration-300 ease-in-out"
          style={{
            opacity: live.cleared && wallpaperBg ? 0 : 1,
          }}
        >
          <PersistentBackground background={effectiveBackground} />
        </div>
      )}

      {/* Camada 2: Transição dos Slides (por padrão é sobre o texto mantendo o fundo) */}
      {isPresenting && (
        <div className="absolute inset-0 z-20">
          <SlideTransition
            slide={live}
            theme={theme}
            asset={asset}
            cleared={live.cleared}
            textHidden={live.textHidden}
            durationMs={300}
            transitionBackground={false}
          />
        </div>
      )}

      {/* Camada 3: Blackout Overlay (Fade para preto suave e seguro) */}
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
