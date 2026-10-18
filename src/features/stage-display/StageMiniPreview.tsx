import { useEffect, useState } from "react";
import { usePresentationStore } from "@/features/presentation/store";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildProps, buildStageProps } from "@/features/slide-themes/themeTemplate";
import {
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_THEME,
} from "@/features/slide-themes/seedThemes";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";
import { useStageConfigStore } from "./configStore";
import { useStageTimerStore } from "./timerStore";

export function StageMiniPreview() {
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { clock24h, showSeconds, nextSlideDisplay, countdownMinutes } =
    useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);

  const themes = useSlideThemesStore((s) => s.themes);
  const broadcastStageTheme = useLiveThemesStore((s) => s.themes.stage);
  const broadcastPublicTheme = useLiveThemesStore((s) => s.themes.public);
  const localStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  const localStageRestTheme = useSlideThemesStore((s) => s.resolveStageRestTheme());

  const isPresentation = Boolean(live.content.media?.themeId);
  const isMedia = live.content.kind === "media" && Boolean(live.content.media);

  const isIdle =
    live.cleared ||
    live.content.kind === "blank" ||
    (!isPresentation &&
      !isMedia &&
      live.content.lines.length === 0 &&
      !live.content.title);

  const stageTheme = isIdle
    ? (localStageRestTheme ?? DEFAULT_STAGE_REST_THEME)
    : (broadcastStageTheme ?? localStageTheme ?? DEFAULT_STAGE_THEME);

  const presentationTheme = isPresentation
    ? (themes.find((t) => t.guid === live.content.media?.themeId) ??
       (broadcastPublicTheme?.guid === live.content.media?.themeId
         ? broadcastPublicTheme
         : null) ??
       (broadcastStageTheme?.guid === live.content.media?.themeId
         ? broadcastStageTheme
         : null) ??
       stageTheme)
    : null;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const stageProps = buildStageProps({
    content: live.content,
    nextUp,
    nowMs: now,
    timer,
    clock24h,
    showSeconds,
    nextSlideDisplay,
    countdownMinutes,
    blackout: live.blackout,
    cleared: live.cleared,
  });

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black">
      {live.blackout ? (
        <div className="absolute inset-0 bg-black" />
      ) : isIdle ? (
        <ScaledStage
          theme={stageTheme}
          asset="music"
          props={stageProps}
          className="absolute inset-0"
        />
      ) : isPresentation && presentationTheme ? (
        <ScaledStage
          theme={presentationTheme}
          asset="text"
          props={buildProps(live.content.kind, live.content, nextUp)}
          showBackground={true}
          className="absolute inset-0"
        />
      ) : isMedia ? (
        <SlideCanvas slide={live} showBackground={true} />
      ) : (
        <ScaledStage
          theme={stageTheme}
          asset="music"
          props={stageProps}
          className="absolute inset-0"
        />
      )}
    </div>
  );
}
