import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { kindToAsset } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { SlideTransition } from "@/features/presentation/SlideTransition";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { MaskOverlay } from "@/components/MaskOverlay";
import { VideoInputLayer } from "@/components/VideoInputLayer";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useOutputPlan } from "@/features/slide-themes/useOutputPlan";
import { filterThemeForLook, overlayThemeForLayer } from "@/features/slide-themes/layers";
import { materializeThemeForContent } from "@/features/slide-themes/outputPlan";
import { DEFAULT_STREAM_THEME } from "@/features/slide-themes/seedThemes";
import { useThemesSync } from "@/features/slide-themes/useThemeSync";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";
import {
  StageAlertBanner,
  StageAlertOverlay,
  useCommunicationStore,
  useCommunicationSync,
} from "@/features/communication";

/**
 * Saída transparente para transmissão ao vivo (OBS Studio, vMix, etc.)
 * Renderiza o slide atual (letras, escrituras bíblicas, textos, comunicados)
 * sobre o canvas 16:9, consumível via Browser Source do OBS (`/#/stream` ou `/output/stream`).
 */
interface StreamViewProps {
  backgroundColor?: string;
  outputId?: string;
}

export default function StreamView({ backgroundColor, outputId }: StreamViewProps = {}) {
  usePresentationSync("stream");
  useThemesSync();
  useCommunicationSync();
  useDisplaysSync();

  const [searchParams] = useSearchParams();
  const effectiveOutputId = outputId ?? searchParams.get("id");
  const { output: activeOutput, plan } = useOutputPlan("lower", effectiveOutputId);
  const look = plan.look;

  const live = usePresentationStore((s) => s.live);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);

  // Garante que o fundo do documento fique completamente transparente para o OBS (salvo se cor de tela customizada)
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    if (!plan.screenColor.enabled) {
      document.body.style.backgroundColor = "transparent";
      document.documentElement.style.backgroundColor = "transparent";
    }
    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, [plan.screenColor.enabled]);

  useEffect(() => {
    void ensureSeeded().then(() => void loadThemes());
  }, [ensureSeeded, loadThemes]);

  const screenBg =
    backgroundColor ??
    (plan.screenColor.enabled ? plan.screenColor.value : "transparent");

  const contentTheme = useMemo(
    () => materializeThemeForContent(plan.contentTheme, live.content),
    [plan.contentTheme, live.content],
  );
  const outputTheme = useMemo(
    () => materializeThemeForContent(plan.theme, live.content) ?? DEFAULT_STREAM_THEME,
    [plan.theme, live.content],
  );
  const overlaySource = contentTheme ?? outputTheme;
  const theme = useMemo(
    () => filterThemeForLook(overlaySource, look),
    [overlaySource, look],
  );
  const announcementsTheme = useMemo(
    () => overlayThemeForLayer(overlaySource, look, "announcements"),
    [overlaySource, look],
  );
  const propsTheme = useMemo(
    () => overlayThemeForLayer(overlaySource, look, "props"),
    [overlaySource, look],
  );

  const asset = kindToAsset(live.content.kind) ?? "music";
  const isPresenting = live.content.kind !== "blank";
  const shouldClear = live.cleared || !isPresenting || !look.slide;
  const overlayVisible = live.content.kind !== "blank" && !live.cleared;

  const isTargeted = Boolean(
    look.messages &&
      activeAlert &&
      (activeAlert.targets?.length
        ? activeAlert.targets.includes("stream")
        : activeAlert.target === "stream"),
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      style={{ backgroundColor: screenBg }}
    >
      {/* Camada: Entrada de Vídeo (NDI) */}
      {look.videoInput && (
        <div className="absolute inset-0 z-[15] pointer-events-none">
          <VideoInputLayer />
        </div>
      )}

      {/* Camada de Conteúdo e Slides Transparente */}
      <div className="absolute inset-0 z-20">
        <SlideTransition
          slide={live}
          theme={theme}
          asset={asset}
          cleared={shouldClear}
          textHidden={live.textHidden}
          durationMs={300}
          transitionBackground={false}
        />
      </div>

      {/* Camada: Anúncios (conteúdo secundário) */}
      {overlayVisible && announcementsTheme && (
        <div className="absolute inset-0 z-[21] pointer-events-none">
          <ScaledStage
            theme={announcementsTheme}
            asset={asset}
            props={buildProps(live.content.kind, live.content, live.nextUp, {
              hideText: live.textHidden,
            })}
            showBackground={false}
          />
        </div>
      )}

      {/* Camada: Props (bug/logo/overlay) */}
      {overlayVisible && propsTheme && (
        <div className="absolute inset-0 z-[22] pointer-events-none">
          <ScaledStage
            theme={propsTheme}
            asset={asset}
            props={buildProps(live.content.kind, live.content, live.nextUp, {
              hideText: live.textHidden,
            })}
            showBackground={false}
          />
        </div>
      )}

      {/* Camada: Máscara (topo) */}
      {look.mask && activeOutput?.mask && (
        <div className="absolute inset-0 z-[26] pointer-events-none">
          <MaskOverlay mask={activeOutput.mask} />
        </div>
      )}

      {/* Camada de Blackout com fade suave */}
      <div
        className="absolute inset-0 z-30 bg-black pointer-events-none transition-opacity duration-300 ease-in-out"
        style={{
          opacity: live.blackout ? 1 : 0,
        }}
      />

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
    </div>
  );
}
