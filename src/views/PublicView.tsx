import { useEffect } from "react";
import { kindToAsset } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";

export default function PublicView() {
  usePresentationSync();
  const live = usePresentationStore((s) => s.live);
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

  if (
    !theme ||
    !asset ||
    live.blackout ||
    live.cleared ||
    live.content.kind === "blank"
  ) {
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
