import { useEffect, useState } from "react";
import { usePresentationStore } from "@/features/presentation/store";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildStageProps } from "@/features/slide-themes/themeTemplate";
import { DEFAULT_STAGE_THEME } from "@/features/slide-themes/seedThemes";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useStageConfigStore } from "./configStore";
import { useStageTimerStore } from "./timerStore";

export function StageMiniPreview() {
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { clock24h, showSeconds, nextSlideDisplay, countdownMinutes } =
    useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.stage);
  const localStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  const stageTheme = broadcastTheme ?? localStageTheme ?? DEFAULT_STAGE_THEME;

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
      <ScaledStage
        theme={stageTheme}
        asset="music"
        props={stageProps}
        className="absolute inset-0"
      />
    </div>
  );
}
