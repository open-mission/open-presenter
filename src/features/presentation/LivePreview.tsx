import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Megaphone,
  Monitor,
  MoreVertical,
  Play,
  Projector,
  Settings,
  Timer,
  Tv,
  Video,
} from "lucide-react";
import { useDisplaysStore } from "@/features/displays/store";
import { OutputPlaceholder } from "@/features/displays/components/OutputPlaceholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { kindToAsset } from "@/core/types";
import { isOutputActive } from "@/features/output-manager/outputActive";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { openDisplaysWindow } from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { usePublicThemeResolver } from "@/features/slide-themes/usePublicThemeResolver";
import { usePresentationStore } from "./store";
import { SlideCanvas } from "./SlideCanvas";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { PersistentBackground } from "@/features/media-shaders/PersistentBackground";
import { isIsfBackground } from "@/features/media-shaders/isfEngine";
import { SlideTransition } from "./SlideTransition";
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import { DEFAULT_STREAM_THEME } from "@/features/slide-themes/seedThemes";
import { contextForSlide } from "@/features/slide-themes/themeResolution";
import { getPageForContext, materializePage } from "@/features/slide-themes/pages";
import {
  StageAlertBanner,
  StageAlertOverlay,
  useCommunicationStore,
} from "@/features/communication";
import { useWallpaperStore } from "./wallpaperStore";
import {
  usePreviewLayoutStore,
  type GridMode,
} from "./previewLayoutStore";
import { wallpaperToBackground } from "./wallpaper";
import type { BackgroundLayer, LiveSlide } from "@/core/types";
import { filterThemeForLook, resolveOutputLook } from "@/features/slide-themes/layers";
import { useOutputOverridesStore } from "@/features/slide-themes/outputOverridesStore";
import { handleAssetDragOver, handleAssetDrop } from "@/features/media-library/dnd";
import { MaskOverlay } from "@/components/MaskOverlay";
import { ResizeHandle } from "@/components/ResizeHandle";
import { HeaderMediaControls } from "@/components/HeaderMediaControls";
import { AlertsAdjustmentTab } from "./tabs/AlertsAdjustmentTab";
import { TimersAdjustmentTab } from "./tabs/TimersAdjustmentTab";
import { cn } from "@/core/lib/utils";

const SOURCE_OPTIONS = [
  { id: "live", label: "Ao Vivo (Telão Principal)", icon: Tv, color: "text-emerald-400" },
  { id: "stage", label: "Retorno de Palco (Stage)", icon: Monitor, color: "text-sky-400" },
  { id: "stream", label: "Transmissão (OBS / Stream)", icon: Video, color: "text-purple-400" },
  { id: "next", label: "Próximo Slide (A Seguir)", icon: ArrowRight, color: "text-amber-400" },
  { id: "prev", label: "Slide Anterior", icon: ArrowLeft, color: "text-zinc-400" },
];

export function LivePreview() {
  const live = usePresentationStore((s) => s.live);
  const preview = usePresentationStore((s) => s.preview);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const stageConfig = useOutputManagerStore((s) => s.configs.stage);
  const stageRuntime = useOutputManagerStore((s) => s.runtime.stage);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const allThemes = useSlideThemesStore((s) => s.themes);
  const resolvePublicTheme = usePublicThemeResolver();

  // Layout & Visibility store (persistente)
  const gridMode = usePreviewLayoutStore((s) => s.gridMode);
  const setGridMode = usePreviewLayoutStore((s) => s.setGridMode);
  const cellAssignments = usePreviewLayoutStore((s) => s.cellAssignments);
  const setCellAssignment = usePreviewLayoutStore((s) => s.setCellAssignment);
  const previewHeight = usePreviewLayoutStore((s) => s.previewHeight);
  const setPreviewHeight = usePreviewLayoutStore((s) => s.setPreviewHeight);
  const adjustmentsTab = usePreviewLayoutStore((s) => s.adjustmentsTab);
  const setAdjustmentsTab = usePreviewLayoutStore((s) => s.setAdjustmentsTab);

  const configuredOutputs = useDisplaysStore((s) => s.outputs);
  const selectedOutputId = useDisplaysStore((s) => s.selectedOutputId);
  const outputOverrides = useOutputOverridesStore((s) => s.overrides);

  const previewOutput = useMemo(() => {
    const publics = configuredOutputs.filter((output) => output.category === "public");
    return (
      publics.find((output) => output.id === selectedOutputId) ??
      publics.find((output) => output.enabled) ??
      publics[0] ??
      null
    );
  }, [configuredOutputs, selectedOutputId]);

  const previewOverride = previewOutput
    ? (outputOverrides[previewOutput.id]?.background ?? null)
    : null;

  const previewTheme = useMemo(
    () => resolvePublicTheme(preview),
    [preview, resolvePublicTheme],
  );
  const liveTheme = useMemo(
    () => resolvePublicTheme(live.content),
    [live.content, resolvePublicTheme],
  );

  const isPublicAlertTargeted = Boolean(
    activeAlert &&
      (activeAlert.targets?.length
        ? activeAlert.targets.includes("public")
        : activeAlert.target === "public"),
  );

  const effectiveBackground: BackgroundLayer = useMemo(() => {
    const isPresentation = Boolean(live.content.media?.themeId);
    if (isPresentation && liveTheme?.css.background && liveTheme.css.background.trim() !== "") {
      const bg = liveTheme.css.background.trim();
      const isISF = isIsfBackground(bg);
      return {
        id: `theme-bg-${liveTheme.guid}`,
        kind: isISF ? "isf" : "css",
        value: bg,
      };
    }

    const isCustomLiveBg =
      live.background.kind !== "color" ||
      (live.background.value && live.background.value !== "#000000");

    if (isCustomLiveBg) {
      if (live.background.kind === "isf" || isIsfBackground(live.background.value)) {
        return {
          id: live.background.id,
          kind: "isf",
          value: live.background.value,
        };
      }
      return live.background;
    }

    if (liveTheme?.css.background && liveTheme.css.background.trim() !== "") {
      const bg = liveTheme.css.background.trim();
      const isISF = isIsfBackground(bg);
      return {
        id: `theme-bg-${liveTheme.guid}`,
        kind: isISF ? "isf" : "css",
        value: bg,
      };
    }

    return live.background;
  }, [live.background, liveTheme, live.content.media?.themeId]);

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const stageActive = isOutputActive(
    stageConfig.mode,
    stageRuntime.open,
    serverRunning,
  );

  const previewSlide: LiveSlide | null = preview
    ? {
        content: preview,
        background: live.background,
        blackout: false,
        cleared: false,
        textHidden: false,
        updatedAt: live.updatedAt,
      }
    : null;

  async function handlePresentPreview() {
    if (!preview) return;
    await usePresentationStore.getState().publishLive(preview, null);
  }

  const isLiveEmpty = live.cleared || live.content.kind === "blank";

  // Total cells according to grid mode
  const totalCells = useMemo(() => {
    switch (gridMode) {
      case "1x2":
        return 2;
      case "2x2":
        return 4;
      case "3x3":
        return 9;
      case "4x4":
        return 16;
      default:
        return 4;
    }
  }, [gridMode]);

  // Renders the preview monitor (Cell 0)
  const renderPreviewCard = () => (
    <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
        <div className="relative aspect-video w-full h-full max-h-full max-w-full flex items-center justify-center">
          {previewSlide ? (
            (() => {
              const asset = kindToAsset(previewSlide.content.kind);
              if (previewTheme && asset) {
                return (
                  <>
                    <BackgroundRenderer
                      background={previewSlide.background}
                      isFirstFrameOnly={true}
                    />
                    <ScaledStage
                      theme={previewTheme}
                      asset={asset}
                      props={buildProps(
                        previewSlide.content.kind,
                        previewSlide.content,
                        null,
                      )}
                    />
                  </>
                );
              }
              return <SlideCanvas slide={previewSlide} isFirstFrameOnly={true} />;
            })()
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground/50 select-none">
              <Eye className="size-5 text-muted-foreground/30" />
              <p className="text-[10px] text-muted-foreground/50">Prévia Vazia</p>
            </div>
          )}
        </div>
      </div>

      {/* Apenas texto no rodapé */}
      <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
        <span className="font-semibold text-zinc-200 truncate">
          PREVIEW{preview ? ` · ${preview.title}${preview.section ? ` (${preview.section})` : ""}` : ""}
        </span>
        {preview ? (
          <button
            type="button"
            onClick={handlePresentPreview}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold text-[9px] hover:bg-primary/90 cursor-pointer shadow-xs"
            title="Apresentar no telão ao vivo (Enter)"
          >
            <Play className="size-2.5 fill-current" />
            <span>Apresentar</span>
          </button>
        ) : (
          <span className="text-[9px] text-zinc-500">Aguardando</span>
        )}
      </div>
    </div>
  );

  // Renders the Live card (Telão)
  const renderLiveCard = () => (
    <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
      <div
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-zinc-950 flex items-center justify-center"
        onDragOver={previewOutput ? handleAssetDragOver : undefined}
        onDrop={previewOutput ? (event) => handleAssetDrop(event, previewOutput) : undefined}
      >
        <div className="relative aspect-video w-full h-full max-h-full max-w-full">
          {isLiveEmpty && !live.blackout && !previewOverride ? (
            wallpaper ? (
              <div className="relative h-full w-full bg-black">
                <BackgroundRenderer background={wallpaperToBackground(wallpaper)} />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center select-none bg-zinc-950">
                <Projector className="size-4 text-zinc-600" />
                <p className="text-[10px] text-zinc-600">Nenhum conteúdo ao vivo</p>
              </div>
            )
          ) : (
            <div className="relative h-full w-full">
              <div
                className="absolute inset-0 transition-opacity duration-300 ease-in-out"
                style={{ opacity: live.cleared && wallpaper ? 0 : 1 }}
              >
                <PersistentBackground background={previewOverride ?? effectiveBackground} />
              </div>
              <div className="absolute inset-0">
                <SlideTransition
                  slide={live}
                  theme={liveTheme}
                  asset={kindToAsset(live.content.kind)}
                  cleared={live.cleared}
                  textHidden={live.textHidden}
                  durationMs={300}
                  transitionBackground={false}
                />
              </div>
            </div>
          )}

          {previewOutput && resolveOutputLook(previewOutput).mask && previewOutput.mask && (
            <div className="absolute inset-0 z-[25] pointer-events-none">
              <MaskOverlay mask={previewOutput.mask} />
            </div>
          )}

          {live.blackout && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85">
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-semibold animate-pulse">
                Blackout
              </Badge>
            </div>
          )}

          {isPublicAlertTargeted && activeAlert && activeAlert.displayMode === "banner_top" && (
            <StageAlertBanner position="top" alert={activeAlert} compact />
          )}
          {isPublicAlertTargeted && activeAlert && activeAlert.displayMode === "banner_bottom" && (
            <StageAlertBanner position="bottom" alert={activeAlert} compact />
          )}
          {isPublicAlertTargeted && activeAlert && activeAlert.displayMode === "overlay" && (
            <StageAlertOverlay alert={activeAlert} compact />
          )}
        </div>
      </div>

      {/* Apenas texto no rodapé */}
      <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
        <span className="font-semibold text-emerald-400 truncate">
          AO VIVO{live.content.title && live.content.title !== "Nenhum slide ao vivo" ? ` · ${live.content.title}` : " · TELÃO"}
        </span>
        <span
          className={cn(
            "text-[9px] font-semibold uppercase tracking-wider",
            live.blackout
              ? "text-destructive"
              : live.cleared && !isLiveEmpty
              ? "text-amber-400"
              : isLiveEmpty
              ? "text-zinc-500"
              : "text-emerald-400",
          )}
        >
          {live.blackout
            ? "Blackout"
            : live.cleared && !isLiveEmpty
            ? "Fundo Ativo"
            : isLiveEmpty
            ? "Livre"
            : "No Ar"}
        </span>
      </div>
    </div>
  );

  // Renders the Stage card
  const renderStageCard = () => (
    <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-black flex items-center justify-center">
        <div className="relative aspect-video w-full h-full max-h-full max-w-full">
          <StageMiniPreview />
        </div>
      </div>

      {/* Apenas texto no rodapé */}
      <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
        <span className="font-semibold text-sky-400 truncate">
          RETORNO · PALCO
        </span>
        <span className="text-[9px] text-zinc-400 font-mono">
          {stageActive ? "Ativo" : "Prévia"}
        </span>
      </div>
    </div>
  );

  // Renders Stream / Lower Third card
  const renderStreamCard = () => {
    const lowerRawTheme =
      allThemes.find((t) => t.category === "stream") ?? DEFAULT_STREAM_THEME;
    const lowerContext = contextForSlide(live.content.kind, live.content.media?.kind) ?? "music";
    const lowerTheme = lowerRawTheme.pages?.length
      ? (getPageForContext(lowerRawTheme, lowerContext)
          ? materializePage(lowerRawTheme, getPageForContext(lowerRawTheme, lowerContext)!)
          : lowerRawTheme)
      : lowerRawTheme;

    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
          <div
            className="relative aspect-video w-full h-full max-h-full max-w-full"
            style={{
              backgroundImage: "repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 14px 14px",
            }}
          >
            <div className="absolute inset-0">
              <SlideTransition
                slide={live}
                theme={lowerTheme}
                asset={kindToAsset(live.content.kind)}
                cleared={live.cleared}
                textHidden={live.textHidden}
                durationMs={300}
                transitionBackground={false}
              />
            </div>
          </div>
        </div>

        {/* Apenas texto no rodapé */}
        <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
          <span className="font-semibold text-purple-400 truncate">
            TRANSMISSÃO · OBS
          </span>
          <span className="text-[9px] text-purple-300/70 font-mono">
            LOWER THIRD
          </span>
        </div>
      </div>
    );
  };

  // Renders Next Slide card
  const renderNextCard = () => {
    const nextUp = live.nextUp;
    const nextSlide: LiveSlide | null = nextUp
      ? {
          content: nextUp,
          background: live.background,
          blackout: false,
          cleared: false,
          textHidden: false,
          updatedAt: live.updatedAt,
        }
      : null;

    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
          <div className="relative aspect-video w-full h-full max-h-full max-w-full">
            {nextSlide ? (
              <SlideCanvas slide={nextSlide} isFirstFrameOnly={true} />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-muted-foreground/50 select-none">
                <ArrowRight className="size-4 text-muted-foreground/30 mb-1" />
                <p className="text-[9px]">Fim da sequência</p>
              </div>
            )}
          </div>
        </div>

        {/* Apenas texto no rodapé */}
        <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
          <span className="font-semibold text-amber-400 truncate">
            PRÓXIMO{nextUp?.title ? ` · ${nextUp.title}` : " SLIDE"}
          </span>
          <span className="text-[9px] text-zinc-400">
            {nextUp?.lines[0] ? `"${nextUp.lines[0]}"` : "A Seguir"}
          </span>
        </div>
      </div>
    );
  };

  // Renders Previous Slide card
  const renderPrevCard = () => {
    const prevUp = live.prevUp;
    const prevSlide: LiveSlide | null = prevUp
      ? {
          content: prevUp,
          background: live.background,
          blackout: false,
          cleared: false,
          textHidden: false,
          updatedAt: live.updatedAt,
        }
      : null;

    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
          <div className="relative aspect-video w-full h-full max-h-full max-w-full">
            {prevSlide ? (
              <SlideCanvas slide={prevSlide} isFirstFrameOnly={true} />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-muted-foreground/50 select-none">
                <ArrowLeft className="size-4 text-muted-foreground/30 mb-1" />
                <p className="text-[9px]">Início da sequência</p>
              </div>
            )}
          </div>
        </div>

        {/* Apenas texto no rodapé */}
        <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
          <span className="font-semibold text-zinc-400 truncate">
            SLIDE ANTERIOR{prevUp?.title ? ` · ${prevUp.title}` : ""}
          </span>
          <span className="text-[9px] text-zinc-500">
            Anterior
          </span>
        </div>
      </div>
    );
  };

  // Renders custom configured output card
  const renderConfiguredOutputCard = (outId: string) => {
    const out = configuredOutputs.find((o) => o.id === outId);
    if (!out) {
      return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
          <div className="flex flex-1 items-center justify-center text-[10px] text-muted-foreground/60">
            Saída não encontrada ({outId})
          </div>
          <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-500 border-t border-white/5">
            <span>{outId}</span>
          </div>
        </div>
      );
    }

    if (out.category === "stage") {
      return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
          <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-black flex items-center justify-center">
            <div className="relative aspect-video w-full h-full max-h-full max-w-full">
              <StageMiniPreview outputId={out.id} />
            </div>
          </div>
          <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
            <span className="font-semibold text-sky-400 truncate">{out.name.toUpperCase()}</span>
            <span className="text-[9px] text-zinc-400 font-mono">{out.type.toUpperCase()}</span>
          </div>
        </div>
      );
    }

    const outputLook = resolveOutputLook(out);
    const overrideBg = outputOverrides[out.id]?.background ?? null;

    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-black select-none">
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
          <div className="relative aspect-video w-full h-full max-h-full max-w-full">
            {isLiveEmpty && !live.blackout && !overrideBg ? (
              wallpaper ? (
                <div className="relative h-full w-full bg-black">
                  <BackgroundRenderer background={wallpaperToBackground(wallpaper)} />
                </div>
              ) : (out.placeholderEnabled ?? true) && out.placeholderType !== "none" ? (
                <div className="relative h-full w-full">
                  <OutputPlaceholder output={out} />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center select-none bg-zinc-950">
                  <Projector className="size-4 text-zinc-600 mb-1" />
                  <p className="text-[10px] text-zinc-500">Telão Livre</p>
                </div>
              )
            ) : (
              <div className="relative h-full w-full">
                <PersistentBackground background={overrideBg ?? effectiveBackground} />
                <div className="absolute inset-0">
                  <SlideTransition
                    slide={live}
                    theme={liveTheme ? filterThemeForLook(liveTheme, outputLook) : liveTheme}
                    asset={kindToAsset(live.content.kind)}
                    cleared={live.cleared || !outputLook.slide}
                    textHidden={live.textHidden}
                    durationMs={300}
                    transitionBackground={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-300 border-t border-white/5">
          <span className="font-semibold text-emerald-400 truncate">{out.name.toUpperCase()}</span>
          <span className="text-[9px] text-zinc-400 font-mono">{out.type.toUpperCase()}</span>
        </div>
      </div>
    );
  };

  // Renders empty placeholder card
  const renderEmptyCard = () => (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-950 select-none">
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground/40">
        <Monitor className="size-4 text-muted-foreground/30" />
        <span className="text-[10px]">Monitor Vazio</span>
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between px-2 bg-zinc-950 text-[10px] text-zinc-500 border-t border-white/5">
        <span className="truncate">VAZIO</span>
        <span className="text-[9px] text-zinc-600">Botão direito</span>
      </div>
    </div>
  );

  // Dispatcher for each cell based on assigned source
  const renderCellContent = (index: number) => {
    if (index === 0) return renderPreviewCard();

    const source = cellAssignments[index] || (index === 1 ? "live" : index === 2 ? "stage" : index === 3 ? "stream" : "empty");

    if (source === "live") return renderLiveCard();
    if (source === "stage") return renderStageCard();
    if (source === "stream") return renderStreamCard();
    if (source === "next") return renderNextCard();
    if (source === "prev") return renderPrevCard();
    if (source.startsWith("output:")) return renderConfiguredOutputCard(source.replace("output:", ""));
    return renderEmptyCard();
  };

  const currentSourceFor = (index: number) => {
    if (index === 0) return "preview";
    return cellAssignments[index] || (index === 1 ? "live" : index === 2 ? "stage" : index === 3 ? "stream" : "empty");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Section: Monitor Grid Area */}
      <div
        className="flex flex-col overflow-hidden shrink-0 bg-black"
        style={{ height: previewHeight }}
      >
        {/* Top toolbar */}
        <div className="flex h-7 items-center justify-between border-b border-white/10 bg-zinc-950 px-2 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-300">Monitores</span>
            <div className="flex items-center rounded border border-white/10 bg-zinc-900 p-0.5">
              {(["1x2", "2x2", "3x3", "4x4"] as GridMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGridMode(mode)}
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[9px] font-semibold transition-all cursor-pointer",
                    gridMode === mode
                      ? "bg-zinc-800 text-white shadow-2xs"
                      : "text-zinc-400 hover:text-white",
                  )}
                  title={`Grade ${mode}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isTauri()) void openDisplaysWindow();
                else window.open("#/displays", "_blank");
              }}
              className="size-5 text-zinc-400 hover:text-white cursor-pointer"
              title="Configurar Saídas de Vídeo"
            >
              <Settings className="size-3" />
            </Button>
          </div>
        </div>

        {/* Grid area - sem margens entre container e grid items, sem bordas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-0 bg-black">
          <div
            className={cn(
              "grid h-full w-full gap-px bg-zinc-900/60",
              gridMode === "1x2" && "grid-cols-2",
              gridMode === "2x2" && "grid-cols-2 grid-rows-2",
              gridMode === "3x3" && "grid-cols-3 grid-rows-3",
              gridMode === "4x4" && "grid-cols-4 grid-rows-4",
            )}
          >
            {Array.from({ length: totalCells }).map((_, idx) => {
              const source = currentSourceFor(idx);

              if (idx === 0) {
                return (
                  <div key={idx} className="h-full w-full overflow-hidden">
                    {renderPreviewCard()}
                  </div>
                );
              }

              return (
                <ContextMenu key={idx}>
                  <ContextMenuTrigger asChild>
                    <div className="relative group h-full w-full overflow-hidden">
                      {renderCellContent(idx)}

                      {/* Dropdown switch button on hover for direct click */}
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex size-5 items-center justify-center rounded bg-black/70 text-zinc-300 hover:text-white backdrop-blur-xs cursor-pointer border border-white/10"
                              title="Alterar monitor"
                            >
                              <MoreVertical className="size-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs">
                              Monitor {idx + 1}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                              value={source}
                              onValueChange={(val) => setCellAssignment(idx, val)}
                            >
                              {SOURCE_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                return (
                                  <DropdownMenuRadioItem
                                    key={opt.id}
                                    value={opt.id}
                                    className="text-xs cursor-pointer"
                                  >
                                    <Icon className={cn("size-3.5 mr-2", opt.color)} />
                                    <span>{opt.label}</span>
                                  </DropdownMenuRadioItem>
                                );
                              })}

                              {configuredOutputs.length > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                                    Saídas de Vídeo
                                  </DropdownMenuLabel>
                                  {configuredOutputs.map((out) => (
                                    <DropdownMenuRadioItem
                                      key={out.id}
                                      value={`output:${out.id}`}
                                      className="text-xs cursor-pointer"
                                    >
                                      <Tv className="size-3.5 mr-2 text-emerald-400" />
                                      <span className="truncate">{out.name}</span>
                                    </DropdownMenuRadioItem>
                                  ))}
                                </>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuRadioItem
                                value="empty"
                                className="text-xs text-muted-foreground cursor-pointer"
                              >
                                Vazio (Nenhum)
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-56">
                    <ContextMenuLabel className="text-xs">
                      Fonte do Monitor {idx + 1}
                    </ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuRadioGroup
                      value={source}
                      onValueChange={(val) => setCellAssignment(idx, val)}
                    >
                      {SOURCE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <ContextMenuRadioItem
                            key={opt.id}
                            value={opt.id}
                            className="text-xs cursor-pointer"
                          >
                            <Icon className={cn("size-3.5 mr-2", opt.color)} />
                            <span>{opt.label}</span>
                          </ContextMenuRadioItem>
                        );
                      })}

                      {configuredOutputs.length > 0 && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuLabel className="text-[10px] text-muted-foreground">
                            Saídas de Vídeo
                          </ContextMenuLabel>
                          {configuredOutputs.map((out) => (
                            <ContextMenuRadioItem
                              key={out.id}
                              value={`output:${out.id}`}
                              className="text-xs cursor-pointer"
                            >
                              <Tv className="size-3.5 mr-2 text-emerald-400" />
                              <span className="truncate">{out.name}</span>
                            </ContextMenuRadioItem>
                          ))}
                        </>
                      )}

                      <ContextMenuSeparator />
                      <ContextMenuRadioItem
                        value="empty"
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        Vazio (Nenhum)
                      </ContextMenuRadioItem>
                    </ContextMenuRadioGroup>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vertical Resize Handle for adjusting grid height */}
      <ResizeHandle
        direction="vertical"
        invertVerticalDelta={true}
        value={previewHeight}
        min={180}
        max={700}
        defaultValue={360}
        onChange={setPreviewHeight}
        label="Redimensionar prévias de monitores"
      />

      {/* Middle: Media Controls Bar */}
      <div className="shrink-0 border-b border-border/60 bg-card/30">
        <HeaderMediaControls />
      </div>

      {/* Bottom: Adjustments Tabs (Avisos & Cronômetros) */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-muted/5">
        {/* Tabs Bar */}
        <div className="flex h-8 items-center justify-between border-b border-border/60 bg-card/60 px-2 shrink-0 select-none">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAdjustmentsTab("alerts")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                adjustmentsTab === "alerts"
                  ? "bg-background text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Megaphone className="size-3.5" />
              <span>Avisos</span>
              {activeAlert && (
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setAdjustmentsTab("timers")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                adjustmentsTab === "timers"
                  ? "bg-background text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Timer className="size-3.5" />
              <span>Cronômetros & Timers</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {adjustmentsTab === "alerts" && <AlertsAdjustmentTab />}
          {adjustmentsTab === "timers" && <TimersAdjustmentTab />}
        </div>
      </div>
    </div>
  );
}
