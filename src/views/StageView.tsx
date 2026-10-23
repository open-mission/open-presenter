import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { resolveStageRenderTheme } from "@/features/slide-themes/themeResolution";
import { materializeThemeForContent, resolveContentTheme } from "@/features/slide-themes/outputPlan";
import { useOutputPlan } from "@/features/slide-themes/useOutputPlan";
import { useThemesSync } from "@/features/slide-themes/useThemeSync";
import { getPageForContext, materializePage } from "@/features/slide-themes/pages";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";

interface StageViewProps {
  backgroundColor?: string;
  outputId?: string;
}

/**
 * Retorno de palco: layout próprio (relógio, próximo slide, painéis). Nesta fase
 * não filtra elementos por camada; só o toggle de Mensagens tem efeito. Ocioso
 * usa o tema de descanso do plano (idle > página rest > padrão).
 */
export default function StageView({ backgroundColor, outputId }: StageViewProps = {}) {
  usePresentationSync("stage");
  useStageTimerSync();
  useThemesSync();
  useCommunicationSync();
  useDisplaysSync();

  const [searchParams] = useSearchParams();
  const effectiveOutputId = outputId ?? searchParams.get("id");
  const { plan } = useOutputPlan("stage", effectiveOutputId);
  const look = plan.look;

  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const prevUp = usePresentationStore((s) => s.live.prevUp);
  const { clock24h, showSeconds, nextSlideDisplay, countdownMinutes } =
    useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);

  const loadThemes = useSlideThemesStore((s) => s.load);
  const themes = useSlideThemesStore((s) => s.themes);
  const mediaThemeId = live.content.media?.themeId ?? null;

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const contentTheme = useMemo(() => {
    const doc = resolveContentTheme(mediaThemeId, themes, "stage");
    return materializeThemeForContent(doc, live.content);
  }, [mediaThemeId, themes, live.content]);

  const stageTheme = plan.theme ?? DEFAULT_STAGE_THEME;
  const liveTheme =
    resolveStageRenderTheme(
      stageTheme,
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

  const screenBg =
    backgroundColor ??
    (plan.screenColor.enabled ? plan.screenColor.value : "#000000");

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isTargeted = Boolean(
    look.messages &&
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
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{ backgroundColor: screenBg }}
    >
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
