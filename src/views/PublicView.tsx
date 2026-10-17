import { useEffect } from "react";
import { kindToAsset, type BackgroundLayer } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
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

  return (
    <div className="relative h-full w-full overflow-hidden bg-black select-none">
      {/* Camada 0: Papel de Parede (Base) */}
      {wallpaperBg && (
        <div className="absolute inset-0 z-0">
          <BackgroundRenderer background={wallpaperBg} />
        </div>
      )}

      {/* Camada 1: Plano de Fundo do Slide / Tema (com fade suave de entrada e saída) */}
      {isPresenting && (
        <div
          className="absolute inset-0 z-10 transition-opacity duration-300 ease-in-out"
          style={{
            opacity: live.cleared && wallpaperBg ? 0 : 1,
          }}
        >
          <BackgroundRenderer background={live.background} />
        </div>
      )}

      {/* Camada 2: Conteúdo dos Slides (com Cross-fade e Fade-in/out) */}
      {isPresenting && (
        <div className="absolute inset-0 z-20">
          <SlideTransition
            slide={live}
            theme={theme}
            asset={asset}
            cleared={live.cleared}
            durationMs={300}
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
