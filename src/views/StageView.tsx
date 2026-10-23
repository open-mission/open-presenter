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
import { filterThemeForLook, overlayThemeForLayer } from "@/features/slide-themes/layers";
import { useOutputPlan } from "@/features/slide-themes/useOutputPlan";
import { MaskOverlay } from "@/components/MaskOverlay";
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
  const { output: activeOutput, plan } = useOutputPlan("stage", effectiveOutputId);
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

  const overlayBase = isIdle
    ? restRender.theme
    : isPresentation && contentTheme
      ? contentTheme
      : liveTheme.theme;
  const overlayAsset = isIdle ? restRender.asset : isPresentation ? "text" : liveTheme.asset;
  const overlayProps = isPresentation
    ? buildProps(live.content.kind, live.content, nextUp)
    : stageProps;
  const announcementsTheme = overlayThemeForLayer(overlayBase, look, "announcements");
  const propsTheme = overlayThemeForLayer(overlayBase, look, "props");

  const restSlideTheme = useMemo(
    () => filterThemeForLook(restRender.theme, look),
    [restRender.theme, look],
  );
  const contentSlideTheme = useMemo(
    () => (contentTheme ? filterThemeForLook(contentTheme, look) : null),
    [contentTheme, look],
  );
  const liveSlideTheme = useMemo(
    () => filterThemeForLook(liveTheme.theme, look),
    [liveTheme.theme, look],
  );

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{ backgroundColor: screenBg }}
    >
      {live.blackout ? (
        <div className="absolute inset-0 bg-black" />
      ) : (
        <>
          {isIdle ? (
            look.slide && (
              <ScaledStage
                theme={restSlideTheme}
                asset={restRender.asset}
                props={stageProps}
                className="absolute inset-0"
              />
            )
          ) : isPresentation && contentSlideTheme ? (
            look.slide && (
              <ScaledStage
                theme={contentSlideTheme}
                asset="text"
                props={buildProps(live.content.kind, live.content, nextUp)}
                showBackground={true}
                className="absolute inset-0"
              />
            )
          ) : isMedia ? (
            look.slide ? (
              <SlideCanvas slide={live} showBackground={true} />
            ) : null
          ) : (
            look.slide && (
              <ScaledStage
                theme={liveSlideTheme}
                asset={liveTheme.asset}
                props={stageProps}
                className="absolute inset-0"
              />
            )
          )}

          {announcementsTheme && (
            <div className="absolute inset-0 z-[21] pointer-events-none">
              <ScaledStage
                theme={announcementsTheme}
                asset={overlayAsset}
                props={overlayProps}
                showBackground={false}
              />
            </div>
          )}

          {propsTheme && (
            <div className="absolute inset-0 z-[22] pointer-events-none">
              <ScaledStage
                theme={propsTheme}
                asset={overlayAsset}
                props={overlayProps}
                showBackground={false}
              />
            </div>
          )}

          {look.mask && activeOutput?.mask && (
            <div className="absolute inset-0 z-[26] pointer-events-none">
              <MaskOverlay mask={activeOutput.mask} />
            </div>
          )}
        </>
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
