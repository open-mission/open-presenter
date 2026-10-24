import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Eye,
  Images,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Pencil,
  Play,
  Radio,
  Sparkles,
  Trash2,
  Video,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreviewZoomControls } from "@/components/PreviewZoomControls";
import { SlideThumbnail } from "@/components/SlideThumbnail";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { mediaKindLabel } from "@/core/lib/media";
import { buildMediaSlides } from "@/core/lib/media";
import { usePersistentNumber } from "@/core/lib/usePersistentNumber";
import { usePersistentViewMode } from "@/core/lib/usePersistentViewMode";
import {
  MEDIA_PREVIEW_GRID,
  previewGridStyle,
} from "@/core/lib/previewGrid";
import {
  appendSlideNumberDigit,
  isSlideNumberKey,
  removeLastSlideNumberDigit,
  resolveSlideNumberIndex,
} from "@/core/lib/slideNumbers";
import { openThemeEditor } from "@/core/ipc/commands";
import type { EventItem, MediaKind } from "@/core/types";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { usePresentationStore } from "@/features/presentation/store";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { usePublicThemeResolver } from "@/features/slide-themes/usePublicThemeResolver";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import { MediaDialog } from "./MediaDialog";
import { SlideNumberIndicator } from "./SlideNumberIndicator";
import { TextEditorDialog } from "./TextEditorDialog";
import { useSetlistStore } from "./store";

const KIND_ICON: Record<MediaKind, typeof AlignLeft> = {
  text: AlignLeft,
  image: ImageIcon,
  folder: Images,
  video: Video,
  audio: Volume2,
};

export function MediaSlidesColumn({
  item,
  partId,
}: {
  item: EventItem;
  partId: string;
}) {
  const media = item.media;
  const studioTheme = useSlideThemesStore((s) =>
    media?.themeId ? s.themes.find((t) => t.guid === media.themeId) : undefined,
  );
  const isStudioPresentation = Boolean(media?.themeId);
  const slides = useMemo(
    () => (media ? buildMediaSlides(item.id, media, studioTheme) : []),
    [item.id, media, studioTheme],
  );
  const runnerIndex = useSetlistStore((s) => s.runnerIndex);
  const projectSection = useSetlistStore((s) => s.projectSection);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const save = useSetlistStore((s) => s.save);
  const base = useMediaBaseUrl();
  const [viewMode, setViewMode] = usePersistentViewMode(
    "open_presenter_setlist_media_view",
    "list",
    ["list", "slides", "text"] as const,
  );
  const [gridZoom, setGridZoom] = usePersistentNumber(
    "open_presenter_setlist_media_zoom",
    MEDIA_PREVIEW_GRID.defaultLevel,
    MEDIA_PREVIEW_GRID.minLevel,
    MEDIA_PREVIEW_GRID.maxLevel,
  );
  const resolveTheme = usePublicThemeResolver();
  const thumbnailThemes = useMemo(
    () => new Map(slides.map((entry) => [entry.slide.id, resolveTheme(entry.slide)])),
    [slides, resolveTheme],
  );

  const [previewIndex, setPreviewIndex] = useState(0);
  const [numberBuffer, setNumberBuffer] = useState("");
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [textEditOpen, setTextEditOpen] = useState(false);

  useEffect(() => {
    const initial = runnerIndex ?? 0;
    setPreviewIndex(Math.min(initial, Math.max(0, slides.length - 1)));
    usePresentationStore
      .getState()
      .setPreview(slides[initial]?.slide ?? slides[0]?.slide ?? null);
  }, [item.id, media, slides.length, runnerIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"]')
      ) {
        return;
      }
      if (slides.length === 0) return;

      const live = usePresentationStore.getState().live;
      const isLive =
        runnerIndex !== null &&
        !live.cleared &&
        !live.blackout &&
        live.content.kind !== "blank";

      if (e.key === "Backspace" && numberBuffer.length > 0) {
        e.preventDefault();
        setNumberBuffer(removeLastSlideNumberDigit(numberBuffer));
        return;
      }

      if (e.key === "Escape") {
        if (numberBuffer.length > 0) {
          e.preventDefault();
          setNumberBuffer("");
          return;
        }
        e.preventDefault();
        void usePresentationStore.getState().clearLive();
        useSetlistStore.setState({ runnerIndex: null });
        return;
      }

      if (isSlideNumberKey(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setNumberBuffer(appendSlideNumberDigit(numberBuffer, e.key));
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(slides.length - 1, previewIndex + 1);
        setPreviewIndex(next);
        usePresentationStore.getState().setPreview(slides[next]?.slide ?? null);
        if (isLive) void projectSection(item.id, next);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const previous = Math.max(0, previewIndex - 1);
        setPreviewIndex(previous);
        usePresentationStore
          .getState()
          .setPreview(slides[previous]?.slide ?? null);
        if (isLive) void projectSection(item.id, previous);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (numberBuffer.length > 0) {
          const targetIdx = resolveSlideNumberIndex(numberBuffer, slides.length);
          setNumberBuffer("");
          if (targetIdx !== null) {
            setPreviewIndex(targetIdx);
            usePresentationStore.getState().setPreview(slides[targetIdx]?.slide ?? null);
            if (isLive) void projectSection(item.id, targetIdx);
            slideRefs.current[targetIdx]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }
          return;
        }
        void projectSection(item.id, previewIndex);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item.id, previewIndex, projectSection, runnerIndex, slides, numberBuffer]);

  if (!media) return null;

  const Icon = KIND_ICON[media.kind];
  const fileCount = media.files?.length ?? 0;
  const isFolder = media.kind === "folder";
  const isText = media.kind === "text";
  const canShowText = isText || isStudioPresentation;
  const activeView = viewMode === "text" && !canShowText ? "slides" : viewMode;
  const canSwitchView = slides.length > 1 || canShowText;

  function handlePreview(index: number) {
    setPreviewIndex(index);
    usePresentationStore.getState().setPreview(slides[index]?.slide ?? null);
  }

  function handlePresent(index = previewIndex) {
    setPreviewIndex(index);
    usePresentationStore.getState().setPreview(slides[index]?.slide ?? null);
    void projectSection(item.id, index);
  }

  function handleRemove() {
    const live = usePresentationStore.getState().live;
    const isThisItemLive = live.content.id.startsWith(`${item.id}#`);
    removeItem(item.id);
    if (isThisItemLive) {
      void usePresentationStore.getState().clearLive();
    }
    void save();
  }

  return (
    <section className="relative flex h-full w-full min-w-0 flex-col border-r border-border bg-background select-none overflow-hidden" onClick={() => setNumberBuffer("")}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              isStudioPresentation
                ? "bg-amber-500/10 text-amber-500"
                : "bg-sky-500/10 text-sky-500"
            }`}
          >
            {isStudioPresentation ? (
              <Sparkles className="size-4" />
            ) : (
              <Icon className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-xs text-foreground">
              {studioTheme?.title || media.title}
            </p>
            {isStudioPresentation ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-500 border-amber-500/30 font-semibold gap-1"
                >
                  <Sparkles className="size-2.5" />
                  Studio de Criação
                </Badge>
              </div>
            ) : (
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                {mediaKindLabel(media.kind)}
                {isFolder ? ` · ${fileCount} imagens` : ""}
                {isText && slides.length > 1 ? ` · ${slides.length} textos` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            title={isStudioPresentation ? "Editar no Studio de Criação" : "Editar mídia"}
            onClick={() => {
              if (isStudioPresentation && media.themeId) {
                void openThemeEditor(media.themeId);
              } else if (media.kind === "text") {
                setTextEditOpen(true);
              } else {
                setEditOpen(true);
              }
            }}
          >
            {isStudioPresentation ? (
              <Sparkles className="size-3.5 text-amber-500" />
            ) : (
              <Pencil className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
            title="Remover da programação"
            onClick={handleRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="default"
            disabled={slides.length === 0}
            className="size-8 shadow-xs transition-all active:scale-95"
            onClick={() => handlePresent()}
            title="Apresentar mídia para o público (Enter)"
            aria-label="Apresentar mídia para o público"
          >
            <Play className="size-3.5 fill-current" />
          </Button>
        </div>
      </div>

      {canSwitchView && (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/20 px-3">
          <ViewModeToggle
            value={activeView}
            onChange={setViewMode}
            options={[
              { value: "list", label: "Lista", icon: List },
              { value: "slides", label: "Slides", icon: LayoutGrid },
              ...(canShowText
                ? [{ value: "text" as const, label: "Texto", icon: AlignLeft }]
                : []),
            ]}
          />
          {activeView !== "list" && (
            <PreviewZoomControls
              config={MEDIA_PREVIEW_GRID}
              level={gridZoom}
              onChange={setGridZoom}
            />
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 [scrollbar-gutter:stable]">
        {slides.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
            <Icon className="size-8 opacity-50" />
            <p className="font-semibold text-foreground">
              {isStudioPresentation
                ? "Apresentação sem conteúdo"
                : isText
                ? "Nenhum texto"
                : isFolder
                ? "Nenhuma imagem"
                : "Nenhuma mídia"}
            </p>
            <p className="max-w-[220px] text-[11px]">
              {isStudioPresentation
                ? "Abra o Studio de Criação para editar o slide."
                : isText
                ? "Edite esta mídia e escreva um ou mais textos."
                : isFolder
                ? "Edite esta mídia e escolha uma pasta com imagens para exibir."
                : "Edite esta mídia e escolha o arquivo para exibir."}
            </p>
          </div>
        ) : activeView !== "list" ? (
          <div
            className="grid gap-2"
            style={previewGridStyle(MEDIA_PREVIEW_GRID, gridZoom)}
          >
            {slides.map((entry) => {
              const isPreview = previewIndex === entry.index;
              const isLive = runnerIndex === entry.index;
              return (
                <button
                  key={entry.slide.id}
                  type="button"
                  ref={(el) => {
                    slideRefs.current[entry.index] = el;
                  }}
                  onClick={() => handlePreview(entry.index)}
                  onDoubleClick={() => handlePresent(entry.index)}
                  className={`group flex min-w-0 flex-col gap-1.5 rounded-lg border p-2 text-left transition-all cursor-pointer ${
                    isLive
                      ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40"
                      : isPreview
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border/80 bg-card/70 hover:border-primary/50"
                  }`}
                  title="1 clique: prévia · 2 cliques: apresentar"
                >
                  {activeView === "slides" ? (
                    <SlideThumbnail
                      content={entry.slide}
                      theme={thumbnailThemes.get(entry.slide.id) ?? null}
                      className="pointer-events-none"
                    />
                  ) : (
                    <p className="min-h-16 whitespace-pre-line text-[11px] leading-snug text-foreground/90">
                      {entry.slide.lines.length > 0
                        ? entry.slide.lines.join("\n")
                        : entry.label}
                    </p>
                  )}
                  <div className="flex min-w-0 items-center justify-between gap-1">
                    <span className="truncate text-[10px] font-medium text-muted-foreground">
                      {entry.label} · #{entry.index + 1}
                    </span>
                    {isLive ? (
                      <Badge className="h-4 shrink-0 gap-1 bg-emerald-600 px-1.5 text-[9px] font-semibold text-white hover:bg-emerald-600">
                        <Radio className="size-2.5" />
                        AO VIVO
                      </Badge>
                    ) : (
                      isPreview && (
                        <Badge
                          variant="secondary"
                          className="h-4 shrink-0 gap-1 border-primary/20 bg-primary/15 px-1.5 text-[9px] font-semibold text-primary"
                        >
                          <Eye className="size-2.5" />
                          Prévia
                        </Badge>
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : isStudioPresentation && studioTheme ? (
          <div className="space-y-3">
            {slides.map((entry) => {
              const isPreview = previewIndex === entry.index;
              const isLive = runnerIndex === entry.index;
              return (
                <div key={entry.slide.id} className="space-y-2">
                  <button
                    type="button"
                    ref={(el) => {
                      slideRefs.current[entry.index] = el;
                    }}
                    onClick={() => handlePreview(entry.index)}
                    onDoubleClick={() => handlePresent(entry.index)}
                    className={`group relative aspect-video w-full overflow-hidden rounded-xl border bg-black shadow-md transition-all cursor-pointer ${
                      isLive
                        ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/10"
                        : isPreview
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border/80 hover:border-primary/50"
                    }`}
                    title="1 clique: prévia · 2 cliques: apresentar"
                  >
                    <ScaledStage
                      theme={studioTheme}
                      asset="text"
                      props={{
                        title: studioTheme.title || media.title,
                        titulo: studioTheme.title || media.title,
                        text: media.text || studioTheme.title || media.title,
                        texto: media.text || studioTheme.title || media.title,
                        lyrics: media.text || studioTheme.title || media.title,
                        letra: media.text || studioTheme.title || media.title,
                      }}
                    />
                    <div className="absolute left-2 top-2 z-30 flex items-center gap-1.5 pointer-events-none">
                      <span className="rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                        #{entry.index + 1}
                      </span>
                      {isPreview && !isLive && (
                        <span className="rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-xs">
                          Prévia
                        </span>
                      )}
                    </div>
                    {isLive && (
                      <div className="absolute right-2 top-2 z-30 pointer-events-none">
                        <Badge className="h-4 gap-1 bg-emerald-600 px-1.5 text-[9px] font-semibold text-white animate-pulse">
                          <Radio className="size-2.5" />
                          AO VIVO
                        </Badge>
                      </div>
                    )}
                  </button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-medium gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                    onClick={() => void openThemeEditor(media.themeId)}
                  >
                    <Sparkles className="size-3.5" />
                    Editar no Studio de Criação
                  </Button>
                </div>
              );
            })}
          </div>
        ) : isFolder ? (
          <div className="grid grid-cols-2 gap-2">
            {slides.map((entry) => {
              const path = entry.slide.media?.path;
              const url = path ? resolveMediaLibraryUrl(path, base) : null;
              const isPreview = previewIndex === entry.index;
              const isLive = runnerIndex === entry.index;
              return (
                <button
                  key={entry.slide.id}
                  type="button"
                  ref={(el) => {
                    slideRefs.current[entry.index] = el;
                  }}
                  onClick={() => handlePreview(entry.index)}
                  onDoubleClick={() => handlePresent(entry.index)}
                  className={`group relative aspect-video overflow-hidden rounded-lg border bg-black transition-all cursor-pointer ${
                    isLive
                      ? "border-emerald-500 ring-2 ring-emerald-500/40"
                      : isPreview
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/70 hover:border-primary/50"
                  }`}
                  title="1 clique: prévia · 2 cliques: apresentar"
                >
                  {url && (
                    <img
                      src={url}
                      alt={entry.label ?? ""}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    {entry.index + 1}
                  </span>
                  {isLive && (
                    <span className="absolute right-1 top-1 rounded bg-emerald-600 px-1 py-0.5 text-[8px] font-bold text-white">
                      NO AR
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : isText ? (
          <div className="space-y-2">
            {slides.map((entry) => {
              const isPreview = previewIndex === entry.index;
              const isLive = runnerIndex === entry.index;
              return (
                <button
                  key={entry.slide.id}
                  type="button"
                  ref={(el) => {
                    slideRefs.current[entry.index] = el;
                  }}
                  onClick={() => handlePreview(entry.index)}
                  onDoubleClick={() => handlePresent(entry.index)}
                  className={`group flex w-full flex-col gap-2 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                    isLive
                      ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40 shadow-xs"
                      : isPreview
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-2xs"
                      : "border-border/80 bg-card/70 hover:border-primary/50 hover:bg-accent/40"
                  }`}
                  title="1 clique: prévia · 2 cliques: apresentar"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                      {entry.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isPreview && !isLive && (
                        <Badge
                          variant="secondary"
                          className="h-4 gap-1 px-1.5 text-[9px] font-semibold bg-primary/15 text-primary border-primary/20"
                        >
                          <Eye className="size-2.5" />
                          Prévia
                        </Badge>
                      )}
                      {isLive && (
                        <Badge
                          variant="default"
                          className="h-4 gap-1 px-1.5 text-[9px] font-semibold bg-emerald-600 hover:bg-emerald-600 text-white animate-pulse"
                        >
                          <Radio className="size-2.5" />
                          Ao Vivo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {entry.slide.lines.map((line, lineIndex) => (
                      <p
                        key={lineIndex}
                        className={`text-xs leading-relaxed ${
                          isLive
                            ? "font-semibold text-foreground"
                            : isPreview
                            ? "font-medium text-foreground"
                            : "text-foreground/90 group-hover:text-foreground"
                        }`}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {isLive
                        ? "Transmitindo no telão"
                        : "Duplo clique para apresentar"}
                    </span>
                    <span className="tabular-nums font-mono text-[9px]">
                      #{entry.index + 1}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div
              ref={(el) => {
                slideRefs.current[0] = el;
              }}
              className={`relative overflow-hidden rounded-xl border bg-black transition-all ${
                runnerIndex === 0
                  ? "border-emerald-500 ring-2 ring-emerald-500/40"
                  : "border-border/70"
              }`}
            >
              {media.kind === "image" && media.path && (
                <img
                  src={resolveMediaLibraryUrl(media.path, base)}
                  alt={media.title}
                  className="aspect-video w-full object-contain"
                />
              )}
              {media.kind === "video" && media.path && (
                <video
                  src={resolveMediaLibraryUrl(media.path, base)}
                  className="aspect-video w-full object-contain"
                  controls
                  muted
                  playsInline
                />
              )}
              {runnerIndex === 0 && (
                <Badge className="absolute right-2 top-2 h-4 gap-1 bg-emerald-600 px-1.5 text-[9px] font-semibold text-white hover:bg-emerald-600">
                  <Radio className="size-2.5" />
                  Ao Vivo
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Eye className="size-3.5" />
                {media.kind === "video"
                  ? "Reprodução com áudio pelo telão"
                  : "Clique em Apresentar para projetar"}
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1 text-destructive hover:underline cursor-pointer"
              >
                <Trash2 className="size-3" />
                Remover
              </button>
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <MediaDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          partId={partId}
          itemId={item.id}
        />
      )}

      {textEditOpen && (
        <TextEditorDialog
          open={textEditOpen}
          onOpenChange={setTextEditOpen}
          partId={partId}
          itemId={item.id}
        />
      )}

      <SlideNumberIndicator buffer={numberBuffer} />
    </section>
  );
}
