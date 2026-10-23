import { useEffect, useMemo, useState } from "react";
import { usePresentationStore } from "@/features/presentation/store";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildProps, buildStageProps } from "@/features/slide-themes/themeTemplate";
import {
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_THEME,
} from "@/features/slide-themes/seedThemes";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { resolveStageRenderTheme } from "@/features/slide-themes/themeResolution";
import {
  materializeThemeForContent,
  resolveContentTheme,
} from "@/features/slide-themes/outputPlan";
import { getPageForContext, materializePage } from "@/features/slide-themes/pages";
import { useOutputPlan } from "@/features/slide-themes/useOutputPlan";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";
import { useStageConfigStore } from "./configStore";
import { useStageTimerStore } from "./timerStore";
import {
  StageAlertBanner,
  StageAlertOverlay,
  useCommunicationStore,
} from "@/features/communication";

interface StageMiniPreviewProps {
  outputId?: string;
}

export function StageMiniPreview({ outputId }: StageMiniPreviewProps = {}) {
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const { clock24h, showSeconds, nextSlideDisplay, countdownMinutes } =
    useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);

  const themes = useSlideThemesStore((s) => s.themes);
  const { plan } = useOutputPlan("stage", outputId ?? null);
  const mediaThemeId = live.content.media?.themeId ?? null;

  const contentTheme = useMemo(() => {
    const doc = resolveContentTheme(mediaThemeId, themes, "stage");
    return materializeThemeForContent(doc, live.content);
  }, [mediaThemeId, themes, live.content]);

  const liveTheme =
    resolveStageRenderTheme(
      plan.theme ?? DEFAULT_STAGE_THEME,
      live.content.kind,
      live.content.media?.kind,
      DEFAULT_STAGE_THEME,
    ) ?? { theme: DEFAULT_STAGE_THEME, asset: "music" as const };

  const restRender = useMemo(() => {
    const candidate = plan.restTheme ?? DEFAULT_STAGE_REST_THEME;
    if (candidate.pages?.length) {
      const page = getPageForContext(candidate, "rest") ?? candidate.pages[0];
      if (page) {
        return { theme: materializePage(candidate, page), asset: "rest" as const };
      }
    }
    return { theme: candidate, asset: "rest" as const };
  }, [plan.restTheme]);

  const isPresentation = Boolean(mediaThemeId);
  const isMedia = live.content.kind === "media" && Boolean(live.content.media);

  const isIdle =
    live.cleared ||
    live.content.kind === "blank" ||
    (!isPresentation &&
      !isMedia &&
      live.content.lines.length === 0 &&
      !live.content.title);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isTargeted = Boolean(
    plan.look.messages &&
      activeAlert &&
      (!activeAlert.targets ||
        activeAlert.targets.length === 0 ||
        activeAlert.targets.includes("stage") ||
        activeAlert.target === "stage"),
  );

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
    activeMessage: isTargeted ? activeAlert?.text : "",
  });

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black">
      {live.blackout ? (
        <div className="absolute inset-0 bg-black" />
      ) : isIdle ? (
        <ScaledStage
          theme={restRender.theme}
          asset={restRender.asset}
          props={stageProps}
          className="absolute inset-0"
        />
      ) : isPresentation && contentTheme ? (
        <ScaledStage
          theme={contentTheme}
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

      {/* Mini Preview do Banner Superior */}
      {isTargeted && activeAlert && activeAlert.displayMode === "banner_top" && (
        <StageAlertBanner position="top" alert={activeAlert} compact />
      )}

      {/* Mini Preview do Banner Inferior */}
      {isTargeted && activeAlert && activeAlert.displayMode === "banner_bottom" && (
        <StageAlertBanner position="bottom" alert={activeAlert} compact />
      )}

      {/* Mini Preview do Overlay */}
      {isTargeted && activeAlert && activeAlert.displayMode === "overlay" && (
        <StageAlertOverlay alert={activeAlert} compact />
      )}
    </div>
  );
}
