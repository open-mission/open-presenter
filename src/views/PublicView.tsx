import { useEffect } from "react";
import { kindToAsset, type BackgroundLayer } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { useWallpaperSync } from "@/features/presentation/useWallpaperSync";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";
import { resolveThemeMediaUrl } from "@/features/theme-editor/media";

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

  if (live.blackout) {
    return <div className="h-full w-full bg-black" />;
  }

  const isPresenting = !live.cleared && live.content.kind !== "blank";

  if (!isPresenting) {
    if (wallpaper) {
      const host = window.location.hostname || "localhost";
      const port = window.location.port ? Number(window.location.port) : 5050;
      const resolved = resolveThemeMediaUrl(wallpaper, host, port) ?? wallpaper;
      const isColor = resolved.startsWith("#") || resolved.startsWith("rgb");
      const isVideo = resolved.endsWith(".mp4");
      const bg: BackgroundLayer = {
        id: "wallpaper",
        kind: isColor ? "color" : isVideo ? "video" : "image",
        value: resolved,
      };
      return (
        <div className="relative h-full w-full overflow-hidden bg-black">
          <BackgroundRenderer background={bg} />
        </div>
      );
    }
    return (
      <div className="h-full w-full bg-black">
        <SlideCanvas slide={live} />
      </div>
    );
  }

  const asset = kindToAsset(live.content.kind);

  if (!theme || !asset) {
    return (
      <div className="h-full w-full bg-black">
        <SlideCanvas slide={live} />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black">
      <div className="relative h-full w-full overflow-hidden bg-black">
        <BackgroundRenderer background={live.background} />
        <ScaledStage
          theme={theme}
          asset={asset}
          props={buildProps(live.content.kind, live.content, live.nextUp)}
        />
      </div>
    </div>
  );
}
