import { useEffect, useMemo, useState } from "react";
import { BookOpen, LayoutGrid, List, Play, Radio, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideThumbnail } from "@/components/SlideThumbnail";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { usePersistentViewMode } from "@/core/lib/usePersistentViewMode";
import type { EventItem, SlideContent } from "@/core/types";
import { usePresentationStore } from "@/features/presentation/store";
import { usePublicThemeResolver } from "@/features/slide-themes/usePublicThemeResolver";
import { buildScriptureItemSlides, useSetlistStore } from "./store";

export function ScriptureSlidesColumn({ item }: { item: EventItem }) {
  const projectSection = useSetlistStore((s) => s.projectSection);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const save = useSetlistStore((s) => s.save);
  const runnerIndex = useSetlistStore((s) => s.runnerIndex);
  const live = usePresentationStore((s) => s.live);

  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [viewMode, setViewMode] = usePersistentViewMode(
    "open_presenter_setlist_scripture_view",
    "list",
    ["list", "slides"] as const,
  );
  const resolveTheme = usePublicThemeResolver();
  const thumbnailThemes = useMemo(
    () => new Map(slides.map((slide) => [slide.id, resolveTheme(slide)])),
    [slides, resolveTheme],
  );

  const ref = item.scripture;
  const isLiveItem =
    Boolean(ref) &&
    live.content.kind === "scripture" &&
    !live.cleared &&
    !live.blackout;

  useEffect(() => {
    let cancelled = false;
    void buildScriptureItemSlides(item).then((nextSlides) => {
      if (cancelled) return;
      setSlides(nextSlides);
      const initial = Math.min(
        runnerIndex ?? 0,
        Math.max(0, nextSlides.length - 1),
      );
      setPreviewIndex(initial);
      usePresentationStore
        .getState()
        .setPreview(nextSlides[initial] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [item, runnerIndex]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"]') ||
        slides.length === 0
      ) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.min(slides.length - 1, previewIndex + 1);
        setPreviewIndex(next);
        usePresentationStore.getState().setPreview(slides[next] ?? null);
        if (isLiveItem) void projectSection(item.id, next);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const previous = Math.max(0, previewIndex - 1);
        setPreviewIndex(previous);
        usePresentationStore.getState().setPreview(slides[previous] ?? null);
        if (isLiveItem) void projectSection(item.id, previous);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void projectSection(item.id, previewIndex);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item.id, slides, previewIndex, projectSection, isLiveItem]);

  function handlePreview(index: number) {
    setPreviewIndex(index);
    usePresentationStore.getState().setPreview(slides[index] ?? null);
  }

  function handlePresent(index = previewIndex) {
    setPreviewIndex(index);
    usePresentationStore.getState().setPreview(slides[index] ?? null);
    void projectSection(item.id, index);
  }

  if (!ref) return null;

  return (
    <section className="relative flex h-full w-80 min-h-0 flex-col border-r border-border bg-background sm:w-96 shrink-0 select-none overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <BookOpen className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-xs text-foreground">
              {ref.bookName} {ref.chapter}:{ref.verse}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="h-4 px-1.5 text-[9px] uppercase text-emerald-600 dark:text-emerald-400"
              >
                Bíblia
              </Badge>
              <span className="truncate text-[11px] text-muted-foreground">
                {ref.versionId} · {slides.length}{" "}
                {slides.length === 1 ? "slide" : "slides"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "list", label: "Lista", icon: List },
              { value: "slides", label: "Slides", icon: LayoutGrid },
            ]}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => {
              removeItem(item.id);
              void save();
            }}
            title="Remover versículo da programação"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            disabled={slides.length === 0}
            onClick={() => handlePresent()}
            title="Apresentar slide do versículo (Enter)"
          >
            <Play className="size-3.5 fill-current" />
            Apresentar
          </Button>
        </div>
      </div>

      <div
        className={
          viewMode === "slides"
            ? "grid flex-1 min-h-0 grid-cols-1 gap-2 overflow-y-auto p-3"
            : "flex-1 min-h-0 space-y-2 overflow-y-auto p-3"
        }
      >
        {slides.length === 0 ? (
          <div className="flex h-48 items-center justify-center p-4 text-center text-xs text-muted-foreground">
            Não foi possível carregar o texto deste versículo.
          </div>
        ) : (
          slides.map((slide, index) => {
            const isLive = live.content.id === slide.id && isLiveItem;
            const isPreview = previewIndex === index;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => handlePreview(index)}
                onDoubleClick={() => handlePresent(index)}
                className={`flex w-full flex-col gap-2 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                  isLive
                    ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40"
                    : isPreview
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border/80 bg-card/70 hover:border-zinc-400 hover:bg-accent/40 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    {slide.scripture && slide.scripture.totalParts > 1
                      ? `Parte ${index + 1}/${slide.scripture.totalParts}`
                      : "Versículo"}
                  </span>
                  {isLive ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                      <Radio className="size-3 animate-pulse" />
                      AO VIVO
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {slide.section}
                    </span>
                  )}
                </div>
                {viewMode === "slides" ? (
                  <SlideThumbnail
                    content={slide}
                    theme={thumbnailThemes.get(slide.id) ?? null}
                    className="rounded-lg pointer-events-none"
                  />
                ) : (
                  <p className="whitespace-pre-line text-xs leading-relaxed text-foreground/90">
                    {slide.lines.join("\n")}
                  </p>
                )}
                <span className="text-[10px] font-medium text-primary">
                  1 clique: prévia · 2 cliques: apresentar
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
