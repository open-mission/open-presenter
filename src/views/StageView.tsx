import { useEffect, useMemo, useState } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { StageAlerts } from "@/features/stage-display/StageAlerts";
import { useStageConfigStore } from "@/features/stage-display/configStore";
import { useStageTimerSync } from "@/features/stage-display/useStageTimerSync";
import { useStageTimerStore } from "@/features/stage-display/timerStore";
import {
  StageAlertBanner,
  StageAlertOverlay,
  useCommunicationStore,
  useCommunicationSync,
} from "@/features/communication";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildProps, buildStageProps } from "@/features/slide-themes/themeTemplate";
import {
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_THEME,
} from "@/features/slide-themes/seedThemes";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import {
  resolveStageRenderTheme,
  resolveStageRestRenderTheme,
} from "@/features/slide-themes/themeResolution";
import { useThemesSync } from "@/features/slide-themes/useThemeSync";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";

export default function StageView() {
  usePresentationSync("stage");
  useStageTimerSync();
  useThemesSync();
  useCommunicationSync();

  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const prevUp = usePresentationStore((s) => s.live.prevUp);
  const { clock24h, showSeconds, nextSlideDisplay, countdownMinutes } =
    useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);

  const loadThemes = useSlideThemesStore((s) => s.load);
  const themes = useSlideThemesStore((s) => s.themes);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
  const stageRestThemeGuid = useSlideThemesStore((s) => s.stageRestThemeGuid);
  const resolveStageTheme = useSlideThemesStore((s) => s.resolveStageTheme);
  const resolveStageRestTheme = useSlideThemesStore((s) => s.resolveStageRestTheme);
  const broadcastStageTheme = useLiveThemesStore((s) => s.themes.stage);
  const broadcastPublicTheme = useLiveThemesStore((s) => s.themes.public);
  const localStageTheme = useMemo(
    () => resolveStageTheme(),
    [resolveStageTheme, themes, stageThemeGuid],
  );
  const localStageRestTheme = useMemo(
    () => resolveStageRestTheme(),
    [resolveStageRestTheme, themes, stageThemeGuid, stageRestThemeGuid],
  );

  const isPresentation = Boolean(live.content.media?.themeId);
  const isMedia = live.content.kind === "media" && Boolean(live.content.media);

  const isIdle =
    live.cleared ||
    live.content.kind === "blank" ||
    (!isPresentation &&
      !isMedia &&
      live.content.lines.length === 0 &&
      !live.content.title);

  const stageTheme = broadcastStageTheme ?? localStageTheme ?? DEFAULT_STAGE_THEME;
  const restTheme = resolveStageRestRenderTheme(
    stageTheme,
    localStageRestTheme ?? DEFAULT_STAGE_REST_THEME,
  );
  const liveTheme =
    resolveStageRenderTheme(
      stageTheme,
      live.content.kind,
      live.content.media?.kind,
      DEFAULT_STAGE_THEME,
    ) ?? { theme: DEFAULT_STAGE_THEME, asset: "music" as const };

  const presentationTheme = isPresentation
    ? (themes.find((t) => t.guid === live.content.media?.themeId) ??
       (broadcastPublicTheme?.guid === live.content.media?.themeId
         ? broadcastPublicTheme
         : null) ??
       (broadcastStageTheme?.guid === live.content.media?.themeId
         ? broadcastStageTheme
         : null) ??
       liveTheme.theme)
    : null;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isTargeted = Boolean(
    activeAlert &&
      (!activeAlert.targets ||
        activeAlert.targets.length === 0 ||
        activeAlert.targets.includes("stage") ||
        activeAlert.target === "stage"),
  );

  const stageProps = buildStageProps({
    content: live.content,
    nextUp,
    prevUp,
    nowMs: now,
    timer,
    clock24h,
    showSeconds,
    nextSlideDisplay,
    countdownMinutes,
    blackout: live.blackout,
    cleared: live.cleared,
    activeMessage: isTargeted ? activeAlert?.text : "",
  });

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
      {live.blackout ? (
        <div className="absolute inset-0 bg-black" />
      ) : isIdle ? (
        <ScaledStage
          theme={restTheme.theme}
          asset={restTheme.asset}
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
          theme={liveTheme.theme}
          asset={liveTheme.asset}
          props={stageProps}
          className="absolute inset-0"
        />
      )}

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

      <div className="absolute inset-x-0 top-6 z-50 px-8 pointer-events-none">
        <StageAlerts />
      </div>
    </div>
  );
}
