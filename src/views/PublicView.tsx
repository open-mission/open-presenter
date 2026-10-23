import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { kindToAsset, type BackgroundLayer } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { PersistentBackground } from "@/features/media-shaders/PersistentBackground";
import { SlideTransition } from "@/features/presentation/SlideTransition";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useOutputPlan } from "@/features/slide-themes/useOutputPlan";
import { filterThemeForLook, overlayThemeForLayer } from "@/features/slide-themes/layers";
import {
  materializeThemeForContent,
  resolveOutputBackground,
} from "@/features/slide-themes/outputPlan";
import { useWallpaperSync } from "@/features/presentation/useWallpaperSync";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";
import { wallpaperToBackground } from "@/features/presentation/wallpaper";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";
import { OutputPlaceholder } from "@/features/displays/components/OutputPlaceholder";

import { useThemesSync } from "@/features/slide-themes/useThemeSync";
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
  const { output: activeOutput, plan } = useOutputPlan("public", effectiveOutputId);
  const look = plan.look;

  const live = usePresentationStore((s) => s.live);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const loadThemes = useSlideThemesStore((s) => s.load);

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const isTargeted = Boolean(
    look.messages &&
      activeAlert &&
      (activeAlert.targets?.length
        ? activeAlert.targets.includes("public")
        : activeAlert.target === "public"),
  );

  const screenBg =
    backgroundColor ??
    (plan.screenColor.enabled ? plan.screenColor.value : "#000000");

  const contentTheme = useMemo(
    () => materializeThemeForContent(plan.contentTheme, live.content),
    [plan.contentTheme, live.content],
  );
  const outputTheme = useMemo(
    () => materializeThemeForContent(plan.theme, live.content),
    [plan.theme, live.content],
  );
  const theme = useMemo(() => {
    const source = contentTheme ?? outputTheme;
    return source ? filterThemeForLook(source, look) : null;
  }, [contentTheme, outputTheme, look]);

  const overlaySource = contentTheme ?? outputTheme;
  const announcementsTheme = useMemo(
    () => (overlaySource ? overlayThemeForLayer(overlaySource, look, "announcements") : null),
    [overlaySource, look],
  );
  const propsTheme = useMemo(
    () => (overlaySource ? overlayThemeForLayer(overlaySource, look, "props") : null),
    [overlaySource, look],
  );
  const overlayVisible = live.content.kind !== "blank" && !live.cleared;

  const asset = kindToAsset(live.content.kind);
  const isPresenting = live.content.kind !== "blank" && look.slide;

  const wallpaperBg: BackgroundLayer | null = wallpaper
    ? wallpaperToBackground(wallpaper)
    : null;

  const effectiveBackground = useMemo(() => {
    if (!look.slide) return null;
    return resolveOutputBackground({
      category: activeOutput?.category ?? "public",
      contentTheme,
      overrideBackground: plan.backgroundOverride,
      liveBackground: live.background,
      theme: outputTheme,
    });
  }, [
    look.slide,
    activeOutput?.category,
    contentTheme,
    outputTheme,
    plan.backgroundOverride,
    live.background,
  ]);

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
      {isPresenting && effectiveBackground && (
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

      {/* Camada: Anúncios (conteúdo secundário) */}
      {overlayVisible && announcementsTheme && (
        <div className="absolute inset-0 z-[21] pointer-events-none">
          <ScaledStage
            theme={announcementsTheme}
            asset={asset ?? "text"}
            props={buildProps(live.content.kind, live.content, live.nextUp, {
              hideText: live.textHidden,
            })}
            showBackground={false}
          />
        </div>
      )}

      {/* Camada: Props (bug/logo/overlay) */}
      {overlayVisible && propsTheme && (
        <div className="absolute inset-0 z-[22] pointer-events-none">
          <ScaledStage
            theme={propsTheme}
            asset={asset ?? "text"}
            props={buildProps(live.content.kind, live.content, live.nextUp, {
              hideText: live.textHidden,
            })}
            showBackground={false}
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
