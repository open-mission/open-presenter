import { useEffect, useState } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { StageAlerts } from "@/features/stage-display/StageAlerts";
import { useStageConfigStore } from "@/features/stage-display/configStore";
import { useStageTimerSync } from "@/features/stage-display/useStageTimerSync";
import { useStageTimerStore } from "@/features/stage-display/timerStore";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildStageProps } from "@/features/slide-themes/themeTemplate";
import { DEFAULT_STAGE_THEME } from "@/features/slide-themes/seedThemes";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";

export default function StageView() {
  usePresentationSync("stage");
  useStageTimerSync();

  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { clock24h, showSeconds, nextSlideDisplay, countdownMinutes } =
    useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);

  const loadThemes = useSlideThemesStore((s) => s.load);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.stage);
  const localStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  const stageTheme = broadcastTheme ?? localStageTheme ?? DEFAULT_STAGE_THEME;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

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
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
      <ScaledStage
        theme={stageTheme}
        asset="music"
        props={stageProps}
        className="absolute inset-0"
      />
      <div className="absolute inset-x-0 top-6 z-50 px-8 pointer-events-none">
        <StageAlerts />
      </div>
    </div>
  );
}
