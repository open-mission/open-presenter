import { useEffect } from "react";
import {
  Eye,
  Monitor,
  Play,
  Projector,
  Radio,
  Tv,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import { StageTimerControls } from "@/features/stage-display/StageTimerControls";
import { useWallpaperStore } from "./wallpaperStore";
import { resolveThemeMediaUrl } from "@/features/theme-editor/media";
import type { BackgroundLayer, LiveSlide } from "@/core/types";

export function LivePreview() {
  const live = usePresentationStore((s) => s.live);
  const preview = usePresentationStore((s) => s.preview);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const host = useOutputManagerStore((s) => s.host);
  const stageConfig = useOutputManagerStore((s) => s.configs.stage);
  const stageRuntime = useOutputManagerStore((s) => s.runtime.stage);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const previewTheme = useSlideThemesStore((s) =>
    preview ? s.resolveTheme("public", preview.kind) : null,
  );
  const liveTheme = useSlideThemesStore((s) =>
    s.resolveTheme("public", live.content.kind),
  );

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

  const port = useOutputManagerStore((s) => s.server.port);

  // Determine if nothing is showing on the Live Public display
  const isLiveEmpty = live.cleared || live.content.kind === "blank";

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Screen 1: Preview (Pré-visualização) */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs">
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
              className="h-6 gap-1 px-2 text-[10px] font-semibold shadow-2xs"
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
            {preview ? `${preview.title}${preview.section ? ` · ${preview.section}` : ""}` : "Aguardando seleção"}
          </span>
          {preview && (
            <span className="tabular-nums font-mono text-[9px] text-primary shrink-0">
              Pronto para projetar
            </span>
          )}
        </div>
      </div>

      {/* Screen 2: Ao Vivo (Telão do Público) */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs">
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
              <div className="relative h-full w-full">
                {(() => {
                  const resolved = resolveThemeMediaUrl(wallpaper, host, port) ?? wallpaper;
                  const isColor = resolved.startsWith("#") || resolved.startsWith("rgb");
                  const isVideo = resolved.endsWith(".mp4");
                  const bg: BackgroundLayer = {
                    id: "wallpaper",
                    kind: isColor ? "color" : isVideo ? "video" : "image",
                    value: resolved,
                  };
                  return <BackgroundRenderer background={bg} />;
                })()}
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
          ) : liveTheme &&
            kindToAsset(live.content.kind) &&
            !live.blackout &&
            !live.cleared &&
            live.content.kind !== "blank" ? (
            <>
              <BackgroundRenderer background={live.background} />
              <ScaledStage
                theme={liveTheme}
                asset={
                  kindToAsset(live.content.kind) ?? "music"
                }
                props={buildProps(
                  live.content.kind,
                  live.content,
                  live.nextUp,
                )}
              />
            </>
          ) : (
            <SlideCanvas slide={live} />
          )}

          {/* Blackout overlay badge indicator if blackout is active */}
          {live.blackout && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <Badge variant="destructive" className="text-xs px-2.5 py-1 font-semibold animate-pulse">
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

      {/* Screen 3: Stage (Tela de Retorno) - Conditionally shown */}
      {stageActive && (
        <div className="flex flex-col gap-2 rounded-xl border border-sky-500/30 bg-card p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Monitor className="size-3.5 text-sky-500" />
              <span className="font-semibold text-xs text-foreground">
                Stage
              </span>
              <span className="text-[10px] text-muted-foreground">(Retorno)</span>
            </div>

            <Badge
              variant="secondary"
              className="h-4 px-1.5 text-[9px] font-semibold bg-sky-500/15 text-sky-500 border-sky-500/30 cursor-pointer"
              onClick={() => openPreferences("outputs", "stage")}
              title="Clique para configurar a Tela de Retorno"
            >
              {stageConfig.mode === "native"
                ? "Nativo"
                : stageConfig.mode === "web"
                ? "Web"
                : "Nativo + Web"}
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
              className="text-[9px] text-sky-500 hover:underline"
            >
              Configurar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
