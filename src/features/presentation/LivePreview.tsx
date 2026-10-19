import { useEffect, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Minus,
  Monitor,
  Play,
  Plus,
  Projector,
  Radio,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Tv,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { kindToAsset } from "@/core/types";
import { isOutputActive } from "@/features/output-manager/outputActive";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { usePreferencesStore } from "@/features/preferences/store";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { usePresentationStore } from "./store";
import { SlideCanvas } from "./SlideCanvas";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { PersistentBackground } from "@/features/media-shaders/PersistentBackground";
import { isIsfBackground } from "@/features/media-shaders/isfEngine";
import { SlideTransition } from "./SlideTransition";
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import { StageTimerControls } from "@/features/stage-display/StageTimerControls";
import { useWallpaperStore } from "./wallpaperStore";
import { usePreviewLayoutStore } from "./previewLayoutStore";
import { wallpaperToBackground } from "./wallpaper";
import type { BackgroundLayer, LiveSlide } from "@/core/types";

export function LivePreview() {
  const live = usePresentationStore((s) => s.live);
  const preview = usePresentationStore((s) => s.preview);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const stageConfig = useOutputManagerStore((s) => s.configs.stage);
  const stageRuntime = useOutputManagerStore((s) => s.runtime.stage);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);
  const loadThemes = useSlideThemesStore((s) => s.load);

  // Layout & Visibility store (persistente)
  const showPreview = usePreviewLayoutStore((s) => s.showPreview);
  const showLive = usePreviewLayoutStore((s) => s.showLive);
  const showStage = usePreviewLayoutStore((s) => s.showStage);
  const zoom = usePreviewLayoutStore((s) => s.zoom);
  const togglePreview = usePreviewLayoutStore((s) => s.togglePreview);
  const toggleLive = usePreviewLayoutStore((s) => s.toggleLive);
  const toggleStage = usePreviewLayoutStore((s) => s.toggleStage);
  const setZoom = usePreviewLayoutStore((s) => s.setZoom);
  const zoomIn = usePreviewLayoutStore((s) => s.zoomIn);
  const zoomOut = usePreviewLayoutStore((s) => s.zoomOut);
  const resetZoom = usePreviewLayoutStore((s) => s.resetZoom);
  const showAll = usePreviewLayoutStore((s) => s.showAll);

  const previewTheme = useSlideThemesStore((s) => {
    if (!preview) return null;
    if (preview.media?.themeId) {
      const found = s.themes.find((t) => t.guid === preview.media?.themeId);
      if (found) return found;
    }
    return s.resolveTheme(
      "public",
      preview.kind,
      preview.media?.themeId,
      preview.media?.kind,
    );
  });
  const liveTheme = useSlideThemesStore((s) => {
    if (live.content.media?.themeId) {
      const found = s.themes.find((t) => t.guid === live.content.media?.themeId);
      if (found) return found;
    }
    return s.resolveTheme(
      "public",
      live.content.kind,
      live.content.media?.themeId,
      live.content.media?.kind,
    );
  });

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

  // Build synthetic LiveSlide for Preview monitor
  const previewSlide: LiveSlide | null = preview
    ? {
        content: preview,
        background: live.background,
        blackout: false,
        cleared: false,
        updatedAt: live.updatedAt,
      }
    : null;

  async function handlePresentPreview() {
    if (!preview) return;
    await usePresentationStore.getState().publishLive(preview, null);
  }

  // Determine if nothing is showing on the Live Public display
  const isLiveEmpty = live.cleared || live.content.kind === "blank";
  const allHidden = !showPreview && !showLive && !showStage;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Barra de Ferramentas dos Monitores de Prévia */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground mr-1 hidden sm:inline">
            Monitores
          </span>

          {/* Botões rápidos para alternar visibilidade de cada monitor */}
          <Button
            variant={showPreview ? "secondary" : "ghost"}
            size="sm"
            onClick={togglePreview}
            className={`h-7 px-2 text-xs gap-1.5 cursor-pointer ${
              !showPreview ? "text-muted-foreground/60" : ""
            }`}
            title={showPreview ? "Ocultar monitor de Prévia" : "Exibir monitor de Prévia"}
          >
            {showPreview ? (
              <Eye className="size-3.5 text-primary" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
            <span className="hidden md:inline">Prévia</span>
          </Button>

          <Button
            variant={showLive ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleLive}
            className={`h-7 px-2 text-xs gap-1.5 cursor-pointer ${
              !showLive ? "text-muted-foreground/60" : ""
            }`}
            title={showLive ? "Ocultar monitor Ao Vivo (Telão)" : "Exibir monitor Ao Vivo (Telão)"}
          >
            <Tv
              className={`size-3.5 ${
                showLive ? "text-emerald-500" : "text-muted-foreground"
              }`}
            />
            <span className="hidden md:inline">Ao Vivo</span>
          </Button>

          <Button
            variant={showStage ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleStage}
            className={`h-7 px-2 text-xs gap-1.5 cursor-pointer ${
              !showStage ? "text-muted-foreground/60" : ""
            }`}
            title={showStage ? "Ocultar monitor de Retorno (Palco)" : "Exibir monitor de Retorno (Palco)"}
          >
            <Monitor
              className={`size-3.5 ${
                showStage ? "text-sky-500" : "text-muted-foreground"
              }`}
            />
            <span className="hidden md:inline">Retorno</span>
          </Button>
        </div>

        {/* Controles de Zoom (+ e - para redimensionar os monitores) */}
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={zoom <= 50}
              className="size-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
              title="Diminuir tamanho dos monitores (-)"
            >
              <Minus className="size-3" />
            </Button>

            <button
              type="button"
              onClick={resetZoom}
              className="text-[10px] font-mono font-medium px-1.5 text-muted-foreground hover:text-foreground cursor-pointer tabular-nums select-none"
              title="Clique para redefinir o zoom para 100%"
            >
              {zoom}%
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={zoom >= 150}
              className="size-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
              title="Aumentar tamanho dos monitores (+)"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Área dos Monitores com Menu de Contexto no Botão Direito */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 select-none [scrollbar-gutter:stable]">
            {allHidden ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60 border border-border/40 mb-3">
                  <EyeOff className="size-6" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Monitores de prévia ocultos
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Todos os monitores foram ocultados. Use a barra de ferramentas acima ou clique com o botão direito para reexibir.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={showAll}
                  className="mt-4 text-xs gap-1.5 cursor-pointer"
                >
                  <Eye className="size-3.5" />
                  <span>Reexibir Todos os Monitores</span>
                </Button>
              </div>
            ) : (
              <div
                className="mx-auto flex flex-col gap-3.5 transition-all duration-150"
                style={{
                  maxWidth: `${Math.round(560 * (zoom / 100))}px`,
                  width: "100%",
                }}
              >
                {/* Screen 1: Preview (Pré-visualização) */}
                {showPreview && (
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Eye className="size-3.5 text-primary" />
                        <span className="font-semibold text-xs text-foreground">
                          Preview
                        </span>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[9px] font-medium text-muted-foreground"
                        >
                          Prévia
                        </Badge>
                      </div>

                      {preview && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-6 gap-1 px-2 text-[10px] font-semibold shadow-2xs cursor-pointer"
                          onClick={handlePresentPreview}
                          title="Apresentar este slide no telão ao vivo (Enter)"
                        >
                          <Play className="size-2.5 fill-current" />
                          Apresentar
                        </Button>
                      )}
                    </div>

                    {/* 16:9 Canvas */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-zinc-950 shadow-inner">
                      {previewSlide ? (
                        (() => {
                          const asset = kindToAsset(previewSlide.content.kind);
                          if (previewTheme && asset) {
                            return (
                              <>
                                <BackgroundRenderer
                                  background={previewSlide.background}
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
                          return <SlideCanvas slide={previewSlide} />;
                        })()
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center text-muted-foreground select-none">
                          <Eye className="size-6 text-muted-foreground/40" />
                          <p className="text-xs font-semibold text-foreground/80">
                            Prévia Vazia
                          </p>
                          <p className="text-[10px] max-w-[200px] text-muted-foreground/80">
                            Clique em uma estrofe da música para carregar a prévia aqui.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Subtitle / Staged Info */}
                    <div className="flex h-5 items-center justify-between px-0.5 text-[10px] text-muted-foreground">
                      <span className="truncate">
                        {preview
                          ? `${preview.title}${preview.section ? ` · ${preview.section}` : ""}`
                          : "Aguardando seleção"}
                      </span>
                      {preview && (
                        <span className="tabular-nums font-mono text-[9px] text-primary shrink-0">
                          Pronto para projetar
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Screen 2: Ao Vivo (Telão do Público) */}
                {showLive && (
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Tv className="size-3.5 text-emerald-500" />
                        <span className="font-semibold text-xs text-foreground">
                          Ao Vivo
                        </span>
                        <span className="text-[10px] text-muted-foreground">(Telão)</span>
                      </div>

                      <div>
                        {live.blackout ? (
                          <Badge
                            variant="destructive"
                            className="h-4 gap-1 px-1.5 text-[9px] font-semibold animate-pulse"
                          >
                            Blackout
                          </Badge>
                        ) : live.cleared && !isLiveEmpty ? (
                          <Badge
                            variant="secondary"
                            className="h-4 gap-1 px-1.5 text-[9px] font-semibold bg-amber-500/15 text-amber-500 border-amber-500/30"
                          >
                            Fundo Ativo
                          </Badge>
                        ) : isLiveEmpty ? (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[9px] text-muted-foreground"
                          >
                            Telão Livre
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="h-4 gap-1 px-1.5 text-[9px] font-semibold bg-emerald-600 hover:bg-emerald-600 text-white animate-pulse"
                          >
                            <Radio className="size-2.5" />
                            No Ar
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 16:9 Canvas or Placeholder */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-zinc-950 shadow-inner">
                      {isLiveEmpty && !live.blackout ? (
                        wallpaper ? (
                          <div className="relative h-full w-full bg-black">
                            <BackgroundRenderer
                              background={wallpaperToBackground(wallpaper)}
                            />
                            <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[9px] font-medium text-zinc-300 backdrop-blur-xs border border-white/10">
                              Papel de Parede Ativo
                            </div>
                          </div>
                        ) : (
                          /* Placeholder Ao Vivo quando não há nada transmitindo */
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center select-none bg-zinc-950">
                            <div className="flex size-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                              <Projector className="size-5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-zinc-300">
                                Placeholder Ao Vivo
                              </p>
                              <p className="mt-0.5 text-[10px] text-zinc-500">
                                Telão desocupado · Nenhum conteúdo ao vivo
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="relative h-full w-full">
                          <div
                            className="absolute inset-0 transition-opacity duration-300 ease-in-out"
                            style={{ opacity: live.cleared && wallpaper ? 0 : 1 }}
                          >
                            <PersistentBackground background={effectiveBackground} />
                          </div>
                          <div className="absolute inset-0">
                            <SlideTransition
                              slide={live}
                              theme={liveTheme}
                              asset={kindToAsset(live.content.kind)}
                              cleared={live.cleared}
                              durationMs={300}
                              transitionBackground={false}
                            />
                          </div>
                        </div>
                      )}

                      {/* Blackout overlay badge indicator if blackout is active */}
                      {live.blackout && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                          <Badge
                            variant="destructive"
                            className="text-xs px-2.5 py-1 font-semibold animate-pulse"
                          >
                            Tela Preta (Blackout)
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Subtitle / Live Output Info */}
                    <div className="flex h-5 items-center justify-between px-0.5 text-[10px] text-muted-foreground">
                      <span className="truncate">
                        {live.blackout
                          ? "Saída escurecida"
                          : isLiveEmpty && wallpaper
                          ? "Papel de parede em exibição (tela desocupada)"
                          : live.cleared
                          ? "Plano de fundo em exibição (sem texto)"
                          : live.content.title}
                      </span>
                      {live.nextUp && !live.blackout && !live.cleared && (
                        <span className="truncate max-w-[140px] text-[9px] opacity-75">
                          Próx: {live.nextUp.lines[0] || live.nextUp.title}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Screen 3: Stage (Tela de Retorno) */}
                {showStage && (
                  <div className="flex flex-col gap-2 rounded-xl border border-sky-500/30 bg-card p-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="size-3.5 text-sky-500" />
                        <span className="font-semibold text-xs text-foreground">
                          Stage
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          (Retorno)
                        </span>
                      </div>

                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[9px] font-semibold bg-sky-500/15 text-sky-500 border-sky-500/30 cursor-pointer"
                        onClick={() => openPreferences("outputs", "stage")}
                        title="Clique para configurar a Tela de Retorno"
                      >
                        {stageActive
                          ? stageConfig.mode === "native"
                            ? "Nativo"
                            : stageConfig.mode === "web"
                            ? "Web"
                            : "Nativo + Web"
                          : "Prévia"}
                      </Badge>
                    </div>

                    {/* 16:9 Mini Stage Canvas */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black shadow-inner">
                      <StageMiniPreview />
                    </div>

                    {/* Stage Stopwatch Controls (operator panel) */}
                    <StageTimerControls />

                    {/* Subtitle */}
                    <div className="flex h-5 items-center justify-between px-0.5 text-[10px] text-muted-foreground">
                      <span className="truncate">Retorno dos músicos no palco</span>
                      <button
                        type="button"
                        onClick={() => openPreferences("outputs", "stage")}
                        className="text-[9px] text-sky-500 hover:underline cursor-pointer"
                      >
                        Configurar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        {/* Menu de Contexto (Botão Direito em Qualquer Ponto da Coluna de Monitores) */}
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="text-xs font-semibold text-muted-foreground">
            Monitores Visíveis
          </ContextMenuLabel>
          <ContextMenuSeparator />

          <ContextMenuCheckboxItem
            checked={showPreview}
            onCheckedChange={togglePreview}
            className="text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Eye className="size-3.5 text-primary" />
              <span>Prévia (Preview)</span>
            </div>
          </ContextMenuCheckboxItem>

          <ContextMenuCheckboxItem
            checked={showLive}
            onCheckedChange={toggleLive}
            className="text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Tv className="size-3.5 text-emerald-500" />
              <span>Ao Vivo (Telão)</span>
            </div>
          </ContextMenuCheckboxItem>

          <ContextMenuCheckboxItem
            checked={showStage}
            onCheckedChange={toggleStage}
            className="text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Monitor className="size-3.5 text-sky-500" />
              <span>Retorno (Palco)</span>
            </div>
          </ContextMenuCheckboxItem>

          <ContextMenuSeparator />
          <ContextMenuLabel className="text-xs font-semibold text-muted-foreground">
            Zoom ({zoom}%)
          </ContextMenuLabel>

          <ContextMenuItem
            onClick={zoomIn}
            disabled={zoom >= 150}
            className="text-xs cursor-pointer"
          >
            <Plus className="size-3.5 mr-2" />
            <span>Aumentar Zoom (+)</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={zoomOut}
            disabled={zoom <= 50}
            className="text-xs cursor-pointer"
          >
            <Minus className="size-3.5 mr-2" />
            <span>Diminuir Zoom (-)</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={resetZoom}
            disabled={zoom === 100}
            className="text-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5 mr-2" />
            <span>Redefinir para 100%</span>
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger className="text-xs cursor-pointer">
              <SlidersHorizontal className="size-3.5 mr-2" />
              <span>Tamanhos Pré-definidos</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem
                onClick={() => setZoom(60)}
                className="text-xs cursor-pointer"
              >
                Compacto (60%)
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setZoom(80)}
                className="text-xs cursor-pointer"
              >
                Pequeno (80%)
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setZoom(100)}
                className="text-xs cursor-pointer"
              >
                Padrão (100%)
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setZoom(120)}
                className="text-xs cursor-pointer"
              >
                Grande (120%)
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setZoom(140)}
                className="text-xs cursor-pointer"
              >
                Máximo (140%)
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => openPreferences("outputs")}
            className="text-xs cursor-pointer"
          >
            <Settings className="size-3.5 mr-2" />
            <span>Configurar Saídas de Vídeo…</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
