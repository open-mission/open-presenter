import { useEffect, useRef, useState } from "react";
import {
  Check,
  Eye,
  Music,
  Pencil,
  Play,
  Radio,
  Split,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SECTION_COLOR, SECTION_LABEL } from "@/core/config/lyrics";
import { buildSongSlides } from "@/core/lib/lyrics";
import { saveSong } from "@/core/ipc/commands";
import type { EventItem, SectionType, ServiceEvent, Song, SongSection } from "@/core/types";
import { usePresentationStore } from "@/features/presentation/store";
import { useSongsStore } from "@/features/songs/store";
import { findEventItem, useSetlistStore } from "./store";

function resolveNextItem(
  item: EventItem | undefined,
  event: ServiceEvent | null,
): { id: string; title: string } | null {
  if (item === undefined || item.nextItemId === null) return null;
  const next = findEventItem(event, item.nextItemId);
  if (next === undefined || next.song === null) return null;
  return { id: next.id, title: next.song.title };
}

export function SongSlidesColumn() {
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const songsCache = useSetlistStore((s) => s.songsCache);
  const runnerIndex = useSetlistStore((s) => s.runnerIndex);
  const loadItemSong = useSetlistStore((s) => s.loadItemSong);
  const projectSection = useSetlistStore((s) => s.projectSection);
  const selectItem = useSetlistStore((s) => s.selectItem);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlide, setDragOverSlide] = useState<{
    index: number;
    position: "before" | "after";
  } | null>(null);
  const dragSlideRef = useRef<number | null>(null);

  const item =
    selectedItemId === null ? undefined : findEventItem(event, selectedItemId);
  const song =
    item !== undefined && item.song !== null
      ? songsCache[item.songId]
      : undefined;

  useEffect(() => {
    if (item !== undefined && item.song !== null && song === undefined) {
      void loadItemSong(item.id);
    }
  }, [item, song, loadItemSong]);

  const slides = song === undefined ? [] : buildSongSlides(song);
  const nextItem = resolveNextItem(item, event);

  // Sync preview slide on song load or change
  useEffect(() => {
    if (slides.length > 0) {
      const initialIdx = runnerIndex ?? 0;
      setPreviewIndex(initialIdx);
      usePresentationStore.getState().setPreview(slides[initialIdx]?.slide ?? null);
    } else {
      setPreviewIndex(null);
      usePresentationStore.getState().setPreview(null);
    }
  }, [selectedItemId, song]);

  // Keyboard navigation: ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter and Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (slides.length === 0 || !item) return;

      const live = usePresentationStore.getState().live;
      const currentRunnerIdx = useSetlistStore.getState().runnerIndex;
      const isPresentationActive =
        currentRunnerIdx !== null &&
        !live.cleared &&
        !live.blackout &&
        live.content.kind !== "blank";

      if (e.key === "Escape") {
        if (isPresentationActive || currentRunnerIdx !== null || !live.cleared) {
          e.preventDefault();
          void usePresentationStore.getState().clearLive();
          useSetlistStore.setState({ runnerIndex: null });
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isPresentationActive && currentRunnerIdx !== null) {
          if (currentRunnerIdx < slides.length - 1) {
            const nextIdx = currentRunnerIdx + 1;
            setPreviewIndex(nextIdx);
            usePresentationStore.getState().setPreview(slides[nextIdx]?.slide ?? null);
            void projectSection(item.id, nextIdx);
            slideRefs.current[nextIdx]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }
        } else {
          setPreviewIndex((current) => {
            const nextIdx =
              current === null ? 0 : Math.min(slides.length - 1, current + 1);
            usePresentationStore.getState().setPreview(slides[nextIdx]?.slide ?? null);
            slideRefs.current[nextIdx]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
            return nextIdx;
          });
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isPresentationActive && currentRunnerIdx !== null) {
          if (currentRunnerIdx > 0) {
            const prevIdx = currentRunnerIdx - 1;
            setPreviewIndex(prevIdx);
            usePresentationStore.getState().setPreview(slides[prevIdx]?.slide ?? null);
            void projectSection(item.id, prevIdx);
            slideRefs.current[prevIdx]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }
        } else {
          setPreviewIndex((current) => {
            const prevIdx =
              current === null ? 0 : Math.max(0, current - 1);
            usePresentationStore.getState().setPreview(slides[prevIdx]?.slide ?? null);
            slideRefs.current[prevIdx]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
            return prevIdx;
          });
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPreviewIndex((current) => {
          const nextIdx =
            current === null ? 0 : Math.min(slides.length - 1, current + 1);
          usePresentationStore.getState().setPreview(slides[nextIdx]?.slide ?? null);
          slideRefs.current[nextIdx]?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
          return nextIdx;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPreviewIndex((current) => {
          const prevIdx =
            current === null ? 0 : Math.max(0, current - 1);
          usePresentationStore.getState().setPreview(slides[prevIdx]?.slide ?? null);
          slideRefs.current[prevIdx]?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
          return prevIdx;
        });
        return;
      }

      if (e.key === "Enter") {
        if (previewIndex !== null) {
          e.preventDefault();
          void projectSection(item.id, previewIndex);
          slideRefs.current[previewIndex]?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides, item, previewIndex, projectSection]);

  function handleSelectPreview(idx: number) {
    setPreviewIndex(idx);
    usePresentationStore.getState().setPreview(slides[idx]?.slide ?? null);
  }

  function handlePresent(idx?: number) {
    const targetIdx = idx ?? previewIndex;
    if (item === undefined || targetIdx === null || targetIdx >= slides.length) {
      return;
    }
    setPreviewIndex(targetIdx);
    usePresentationStore.getState().setPreview(slides[targetIdx]?.slide ?? null);
    void projectSection(item.id, targetIdx);
  }

  // Context Menu Actions
  function handleEditSong() {
    if (song) {
      void useSongsStore.getState().editSong(song.id);
    }
  }

  async function handleUpdateSectionLabel(sectionIndex: number, newType: SectionType) {
    if (!song || !item) return;
    const updatedSections = song.sections.map((sec, idx) =>
      idx === sectionIndex ? { ...sec, sectionType: newType } : sec
    );
    const updatedSong: Song = {
      ...song,
      sections: updatedSections,
    };
    try {
      await saveSong(updatedSong);
      useSetlistStore.getState().invalidateSong(song.id, {
        id: song.id,
        title: song.title,
        artist: song.artist,
      });
      await useSetlistStore.getState().loadItemSong(item.id);
    } catch (err) {
      console.error("Erro ao atualizar rótulo:", err);
    }
  }

  async function handleSplitSection(sectionIndex: number, linesPerSlide: 1 | 2) {
    if (!song || !item) return;
    const target = song.sections[sectionIndex];
    if (!target || target.lines.length <= linesPerSlide) return;

    const newSections: SongSection[] = [];
    for (let i = 0; i < target.lines.length; i += linesPerSlide) {
      newSections.push({
        sectionType: target.sectionType,
        lines: target.lines.slice(i, i + linesPerSlide),
      });
    }

    const updatedSections = [...song.sections];
    updatedSections.splice(sectionIndex, 1, ...newSections);
    const updatedSong: Song = {
      ...song,
      sections: updatedSections,
    };

    try {
      await saveSong(updatedSong);
      useSetlistStore.getState().invalidateSong(song.id, {
        id: song.id,
        title: song.title,
        artist: song.artist,
      });
      await useSetlistStore.getState().loadItemSong(item.id);
    } catch (err) {
      console.error("Erro ao dividir slide:", err);
    }
  }

  async function handleReorderSlides(
    sourceIndex: number,
    targetIndex: number,
    position: "before" | "after",
  ) {
    if (!song || !item) return;
    if (sourceIndex === targetIndex) return;

    const sections = [...song.sections];
    const [moved] = sections.splice(sourceIndex, 1);
    if (!moved) return;

    let destIndex = targetIndex;
    if (position === "before") {
      destIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    } else {
      destIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1;
    }
    const safeDest = Math.max(0, Math.min(sections.length, destIndex));
    sections.splice(safeDest, 0, moved);

    const updatedSong: Song = {
      ...song,
      sections,
    };

    try {
      await saveSong(updatedSong);
      useSetlistStore.getState().invalidateSong(song.id, {
        id: song.id,
        title: song.title,
        artist: song.artist,
      });
      await useSetlistStore.getState().loadItemSong(item.id);
    } catch (err) {
      console.error("Erro ao reordenar estrofes:", err);
    }
  }

  return (
    <section
      onContextMenu={(e) => {
        // Prevent default browser context menu throughout column
        e.preventDefault();
      }}
      className="flex h-full w-80 min-h-0 flex-col border-r border-border bg-background sm:w-96 shrink-0 select-none overflow-hidden"
    >
      {/* Top Header with increased padding top & bottom */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
        <div className="min-w-0 flex-1 pr-3">
          <p className="truncate font-semibold text-xs text-foreground">
            {song?.title || item?.song?.title || "Letra & Estrofes"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground mt-0.5">
            {song
              ? `${song.artist} · ${slides.length} estrofes`
              : "Selecione uma música"}
          </p>
        </div>

        {/* Action: Apresentar slide selecionado para o público */}
        {item && slides.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={previewIndex === null}
            className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs transition-all active:scale-95"
            onClick={() => handlePresent()}
            title="Apresentar slide para o público (Enter)"
          >
            <Play className="size-3.5 fill-current" />
            Apresentar
          </Button>
        )}
      </div>

      {/* Slides Cards List (Scrollable with persistent native scrollbar) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 [scrollbar-gutter:stable]">
          {!item ? (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
              <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Music className="size-5" />
              </div>
              <p className="font-semibold text-foreground">Nenhuma música selecionada</p>
              <p className="mt-1 text-[11px] max-w-[200px]">
                Selecione uma música na programação à esquerda para exibir e projetar as estrofes.
              </p>
            </div>
          ) : song === undefined ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Carregando letra e estrofes…
            </div>
          ) : (
            slides.map((block) => {
              const isLive = runnerIndex === block.index;
              const isPreview = previewIndex === block.index;
              const sectionType = block.sectionType ?? "verse";
              const colorClass = SECTION_COLOR[sectionType] ?? "bg-zinc-700 text-white";

              const isBeingDragged =
                (dragSlideRef.current ?? draggedSlideIndex) === block.index;
              const isHoveredOver = dragOverSlide?.index === block.index;

              return (
                <ContextMenu key={block.index}>
                  <ContextMenuTrigger asChild>
                    <div
                      ref={(el) => {
                        slideRefs.current[block.index] = el;
                      }}
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        dragSlideRef.current = block.index;
                        setDraggedSlideIndex(block.index);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", `slide:${block.index}`);
                      }}
                      onDragEnd={() => {
                        dragSlideRef.current = null;
                        setDraggedSlideIndex(null);
                        setDragOverSlide(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position: "before" | "after" =
                          e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                        setDragOverSlide({
                          index: block.index,
                          position,
                        });
                      }}
                      onDragLeave={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (
                          e.clientX < rect.left ||
                          e.clientX >= rect.right ||
                          e.clientY < rect.top ||
                          e.clientY >= rect.bottom
                        ) {
                          if (dragOverSlide?.index === block.index) {
                            setDragOverSlide(null);
                          }
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const srcIdx = dragSlideRef.current ?? draggedSlideIndex;
                        const position = dragOverSlide?.position ?? "after";
                        if (srcIdx !== null && srcIdx !== block.index) {
                          void handleReorderSlides(srcIdx, block.index, position);
                        }
                        dragSlideRef.current = null;
                        setDraggedSlideIndex(null);
                        setDragOverSlide(null);
                      }}
                      onClick={() => handleSelectPreview(block.index)}
                      onDoubleClick={() => handlePresent(block.index)}
                      className={`group relative flex cursor-grab active:cursor-grabbing flex-col gap-2 rounded-xl border p-3.5 transition-all outline-none select-none ${
                        isLive
                          ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40 shadow-xs"
                          : isPreview
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-2xs"
                          : "border-border/80 bg-card/70 hover:border-zinc-400 hover:bg-accent/40 dark:hover:border-zinc-700"
                      } ${
                        isBeingDragged ? "opacity-35 scale-[0.98]" : ""
                      } ${
                        isHoveredOver && dragOverSlide?.position === "before"
                          ? "border-t-2 border-t-primary shadow-xs"
                          : ""
                      } ${
                        isHoveredOver && dragOverSlide?.position === "after"
                          ? "border-b-2 border-b-primary shadow-xs"
                          : ""
                      }`}
                      title="1 clique: Prévia · 2 cliques: Apresentar · Arraste para reordenar"
                    >
                      {/* Card Header: Section Badge & Status Pills */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase shadow-2xs ${colorClass}`}
                          >
                            {block.label}
                          </span>
                        </div>

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

                      {/* Lyrics Text Preview */}
                      <div className="space-y-1">
                        {block.slide.lines.map((line, lIdx) => (
                          <p
                            key={lIdx}
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

                      {/* Bottom indicator hint */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {isLive ? "Transmitindo no telão" : "Duplo clique para apresentar"}
                        </span>
                        <span className="tabular-nums font-mono text-[9px]">
                          #{block.index + 1}
                        </span>
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-52">
                    {/* 1. Editar */}
                    <ContextMenuItem onClick={() => handleEditSong()}>
                      <Pencil className="size-3.5 mr-2" />
                      <span>Editar Música</span>
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {/* 2. Rótulo > */}
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Tag className="size-3.5 mr-2" />
                        <span>Rótulo</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-48">
                        {(Object.entries(SECTION_LABEL) as [SectionType, string][]).map(
                          ([typeKey, typeLabel]) => (
                            <ContextMenuItem
                              key={typeKey}
                              onClick={() => handleUpdateSectionLabel(block.index, typeKey)}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: SECTION_COLOR[typeKey] }}
                                />
                                <span>{typeLabel}</span>
                              </div>
                              {block.sectionType === typeKey && (
                                <Check className="size-3.5 text-primary" />
                              )}
                            </ContextMenuItem>
                          ),
                        )}
                      </ContextMenuSubContent>
                    </ContextMenuSub>

                    {/* 3. Dividir > */}
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Split className="size-3.5 mr-2" />
                        <span>Dividir</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-44">
                        <ContextMenuItem
                          disabled={block.slide.lines.length <= 2}
                          onClick={() => handleSplitSection(block.index, 2)}
                          className="flex items-center justify-between"
                        >
                          <span>2 Linhas</span>
                          {block.slide.lines.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.ceil(block.slide.lines.length / 2)} slides
                            </span>
                          )}
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={block.slide.lines.length <= 1}
                          onClick={() => handleSplitSection(block.index, 1)}
                          className="flex items-center justify-between"
                        >
                          <span>1 Linha</span>
                          {block.slide.lines.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              {block.slide.lines.length} slides
                            </span>
                          )}
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })
          )}

          {/* Next song transition indicator */}
          {nextItem !== null && (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs justify-between text-muted-foreground hover:text-foreground"
                onClick={() => {
                  selectItem(nextItem.id);
                  handlePresent(0);
                }}
              >
                <span>Próxima música: <strong className="text-foreground">{nextItem.title}</strong></span>
                <Play className="size-3 fill-current ml-2" />
              </Button>
            </div>
          )}
      </div>
    </section>
  );
}
