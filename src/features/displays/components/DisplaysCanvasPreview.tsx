import { useMemo, useState } from "react";
import type { DisplayOutput } from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Globe, Info, Monitor, Tv } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { usePresentationStore } from "@/features/presentation/store";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { SlideTransition } from "@/features/presentation/SlideTransition";
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { PersistentBackground } from "@/features/media-shaders/PersistentBackground";
import { wallpaperToBackground } from "@/features/presentation/wallpaper";
import { kindToAsset } from "@/core/types";
import { contextForSlide } from "@/features/slide-themes/themeResolution";
import { getPageForContext, materializePage } from "@/features/slide-themes/pages";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_THEME,
  DEFAULT_STREAM_THEME,
} from "@/features/slide-themes/seedThemes";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import {
  filterThemeForLook,
  resolveOutputLook,
} from "@/features/slide-themes/layers";
import { useOutputOverridesStore } from "@/features/slide-themes/outputOverridesStore";
import { handleAssetDragOver, handleAssetDrop } from "@/features/media-library/dnd";
import { OutputPlaceholder } from "./OutputPlaceholder";

interface DisplaysCanvasPreviewProps {
  output: DisplayOutput;
}

export function DisplaysCanvasPreview({ output }: DisplaysCanvasPreviewProps) {
  const [viewMode, setViewMode] = useState<"live" | "info">("live");

  const live = usePresentationStore((s) => s.live);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const themes = useSlideThemesStore((s) => s.themes);
  const look = resolveOutputLook(output);
  const overrideBackground = useOutputOverridesStore(
    (s) => s.overrides[output.id]?.background ?? null,
  );

  // Compute aspect ratio CSS
  const { width, height } = output.resolution;
  const ratio = width > 0 && height > 0 ? `${width} / ${height}` : "16 / 9";

  // Check if color is transparent or semi-transparent
  const isTransparent =
    (output.category === "lower" && !output.backgroundColorEnabled) ||
    output.backgroundColor === "transparent" ||
    output.backgroundColor?.startsWith("rgba(0, 0, 0, 0)") ||
    output.backgroundColor?.startsWith("rgba(0,0,0,0)");

  const effectiveBg = output.backgroundColorEnabled
    ? output.backgroundColor
    : output.category === "lower"
      ? "transparent"
      : "#000000";

  const isPresenting =
    live.content.kind !== "blank" && !live.cleared && look.slide;

  // Resolve theme for this output
  const activeTheme = useMemo(() => {
    if (output.defaultThemeGuid) {
      const explicit = themes.find((t) => t.guid === output.defaultThemeGuid);
      if (explicit) return explicit;
    }
    if (output.category === "lower") {
      return themes.find((t) => t.category === "stream") ?? DEFAULT_STREAM_THEME;
    }
    if (output.category === "stage") {
      return themes.find((t) => t.category === "stage") ?? DEFAULT_STAGE_THEME;
    }
    return themes.find((t) => t.category !== "stage" && t.category !== "stream") ?? DEFAULT_PUBLIC_THEME;
  }, [themes, output.defaultThemeGuid, output.category]);

  const context = contextForSlide(live.content.kind, live.content.media?.kind) ?? "music";

  const materializedTheme = useMemo(() => {
    if (activeTheme.pages?.length) {
      const page = getPageForContext(activeTheme, context) ?? activeTheme.pages[0];
      return page ? materializePage(activeTheme, page) : activeTheme;
    }
    return activeTheme;
  }, [activeTheme, context]);

  const visibleTheme = useMemo(
    () => filterThemeForLook(materializedTheme, look),
    [materializedTheme, look],
  );

  const sampleTheme = useMemo(() => {
    const base = activeTheme.pages?.length
      ? (() => {
          const page = getPageForContext(activeTheme, "music") ?? activeTheme.pages[0];
          return page ? materializePage(activeTheme, page) : activeTheme;
        })()
      : activeTheme;
    return filterThemeForLook(base, look);
  }, [activeTheme, look]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/40 overflow-hidden relative select-none">
      {/* Visual Canvas Framing */}
      <div className="w-full max-w-xl max-h-[380px] flex flex-col items-center justify-center relative">
        <div
          className="w-full relative rounded-lg border-2 border-zinc-700/80 shadow-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-200"
          style={{
            aspectRatio: ratio,
            backgroundColor: isTransparent ? "transparent" : effectiveBg,
            backgroundImage: isTransparent
              ? "repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 16px 16px"
              : undefined,
          }}
          onDragOver={handleAssetDragOver}
          onDrop={(event) => handleAssetDrop(event, output)}
        >
          {/* Subtle grid lines inside canvas */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 z-0"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
              backgroundSize: "20% 20%",
            }}
          />

          {/* VIEW MODE: LIVE / THEME CONTENT */}
          {viewMode === "live" ? (
            <div className="absolute inset-0 z-10 overflow-hidden">
              {output.category === "stage" ? (
                <div className="relative w-full h-full bg-black">
                  <StageMiniPreview outputId={output.id} />
                </div>
              ) : output.category === "lower" ? (
                <div className="relative w-full h-full">
                  {isPresenting ? (
                    <SlideTransition
                      slide={live}
                      theme={visibleTheme}
                      asset={kindToAsset(live.content.kind)}
                      cleared={live.cleared || !look.slide}
                      textHidden={live.textHidden}
                      durationMs={300}
                      transitionBackground={false}
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <ScaledStage
                        theme={sampleTheme}
                        asset="music"
                        props={SAMPLES.music.props}
                        showBackground={false}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Public Output */
                <div className="relative w-full h-full">
                  {isPresenting ? (
                    <>
                      <PersistentBackground background={overrideBackground ?? live.background} />
                      <div className="absolute inset-0">
                        <SlideTransition
                          slide={live}
                          theme={visibleTheme}
                          asset={kindToAsset(live.content.kind)}
                          cleared={live.cleared || !look.slide}
                          textHidden={live.textHidden}
                          durationMs={300}
                          transitionBackground={false}
                        />
                      </div>
                    </>
                  ) : (output.placeholderEnabled ?? true) && output.placeholderType !== "none" ? (
                    <div className="relative w-full h-full">
                      <OutputPlaceholder output={output} />
                    </div>
                  ) : wallpaper ? (
                    <div className="relative w-full h-full">
                      <BackgroundRenderer background={wallpaperToBackground(wallpaper)} />
                      <div className="absolute inset-0">
                        <ScaledStage
                          theme={sampleTheme}
                          asset="music"
                          props={SAMPLES.music.props}
                          showBackground={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-full">
                      <ScaledStage
                        theme={sampleTheme}
                        asset="music"
                        props={SAMPLES.music.props}
                        showBackground={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* VIEW MODE: HARDWARE INFO CARD */
            <div className="z-10 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-md bg-zinc-900/85 backdrop-blur border border-zinc-700/70 text-zinc-100 shadow-md">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {output.type === "monitor" && <Monitor className="size-4 text-blue-400" />}
                {output.type === "html" && <Globe className="size-4 text-emerald-400" />}
                {output.type === "virtual" && <Tv className="size-4 text-amber-400" />}
                <span>{output.monitorName || output.name}</span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                <span>{output.resolution.width} x {output.resolution.height}</span>
                <span>•</span>
                <span className="uppercase">{output.aspectRatio}</span>
              </div>
            </div>
          )}

          {/* Top Left Status Badge */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] h-5 px-1.5 gap-1 font-mono uppercase bg-zinc-900/90 backdrop-blur border border-zinc-700",
                output.enabled
                  ? "text-emerald-300 border-emerald-500/40"
                  : "text-zinc-400",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  output.enabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500",
                )}
              />
              {output.enabled ? "Ativo" : "Desativado"}
            </Badge>

            {viewMode === "live" && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-5 px-1.5 font-medium bg-zinc-900/90 backdrop-blur border border-zinc-700",
                  isPresenting ? "text-emerald-400 border-emerald-500/40" : "text-zinc-400",
                )}
              >
                {isPresenting ? "No Ar (Live)" : "Amostra do Modelo"}
              </Badge>
            )}
          </div>

          {/* Top Right Toggle View Mode (Live vs Hardware) */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-zinc-900/90 backdrop-blur border border-zinc-700/80 rounded-md p-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setViewMode("live")}
              className={cn(
                "size-6 rounded text-xs transition-colors",
                viewMode === "live"
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white",
              )}
              title="Ver prévia de conteúdo do slide / tema"
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setViewMode("info")}
              className={cn(
                "size-6 rounded text-xs transition-colors",
                viewMode === "info"
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white",
              )}
              title="Ver informações técnicas de hardware"
            >
              <Info className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
