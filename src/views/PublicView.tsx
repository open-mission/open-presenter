import { useEffect, useMemo } from "react";
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
import { parseMediaWithFit } from "@/features/theme-editor/media";

export default function PublicView() {
  usePresentationSync("public");
  useWallpaperSync();
  const live = usePresentationStore((s) => s.live);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.public);
  const localTheme = useSlideThemesStore((s) =>
    s.resolveTheme("public", live.content.kind),
  );
  const theme = broadcastTheme ?? localTheme;

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const asset = kindToAsset(live.content.kind);
  const isPresenting = live.content.kind !== "blank";

  // Prepara o papel de parede se definido
  const wallpaperBg: BackgroundLayer | null = wallpaper
    ? (() => {
        const { url } = parseMediaWithFit(wallpaper);
        const isColor = url.startsWith("#") || url.startsWith("rgb");
        const isVideo =
          url.toLowerCase().endsWith(".mp4") ||
          url.toLowerCase().endsWith(".webm");
        return {
          id: "wallpaper",
          kind: isColor ? "color" : isVideo ? "video" : "image",
          value: wallpaper,
        };
      })()
    : null;

  // Resolve o plano de fundo efetivo do slide/tema
  const effectiveBackground: BackgroundLayer = useMemo(() => {
    const isCustomLiveBg =
      live.background.kind !== "color" ||
      (live.background.value && live.background.value !== "#000000");

    if (isCustomLiveBg) {
      return live.background;
    }

    if (theme?.css.background && theme.css.background.trim() !== "") {
      return {
        id: `theme-bg-${theme.guid}`,
        kind: "css",
        value: theme.css.background,
      };
    }

    return live.background;
  }, [live.background, theme]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black select-none">
      {/* Camada 0: Papel de Parede (Base) */}
      {wallpaperBg && (
        <div className="absolute inset-0 z-0">
          <BackgroundRenderer background={wallpaperBg} />
        </div>
      )}

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
    </div>
  );
}
