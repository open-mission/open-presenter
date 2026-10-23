import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Check,
  Eye,
  LayoutGrid,
  List,
  Music,
  Pencil,
  Play,
  Radio,
  Split,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreviewZoomControls } from "@/components/PreviewZoomControls";
import { SlideThumbnail } from "@/components/SlideThumbnail";
import { ViewModeToggle } from "@/components/ViewModeToggle";
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
import {
  buildSongSlides,
  computeSlideGroups,
  splitSection,
  type RunnerSlide,
  type SlideGroup,
} from "@/core/lib/lyrics";
import { findSongGroup, songGroupColor } from "@/core/lib/songGroups";
import {
  appendSlideNumberDigit,
  isSlideNumberKey,
  removeLastSlideNumberDigit,
  resolveSlideNumberIndex,
} from "@/core/lib/slideNumbers";
import { saveSong } from "@/core/ipc/commands";
import { usePersistentViewMode } from "@/core/lib/usePersistentViewMode";
import { usePersistentNumber } from "@/core/lib/usePersistentNumber";
import {
  SONG_PREVIEW_GRID,
  previewGridStyle,
} from "@/core/lib/previewGrid";
import { useSongDefaultsStore } from "@/core/store/songDefaultsStore";
import type { EventItem, SectionType, ServiceEvent, Song } from "@/core/types";
import { usePublicThemeResolver } from "@/features/slide-themes/usePublicThemeResolver";
import { handleAssetDrop, readAssetPayload } from "@/features/media-library/dnd";
import { resolveApplyTarget } from "@/features/media-library/applyAsset";
import { usePresentationStore } from "@/features/presentation/store";
import { useSongsStore } from "@/features/songs/store";
import { useSongGroupsStore } from "@/features/songs/songGroupsStore";
import { MediaSlidesColumn } from "./MediaSlidesColumn";
import { ScriptureSlidesColumn } from "./ScriptureSlidesColumn";
import { SlideNumberIndicator } from "./SlideNumberIndicator";
import { findEventItem, useSetlistStore } from "./store";

function resolveNextItem(
  item: EventItem | undefined,
  event: ServiceEvent | null,
): { id: string; title: string } | null {
  if (item === undefined || item.nextItemId === null) return null;
  const next = findEventItem(event, item.nextItemId);
  if (next === undefined) return null;
  const title =
    next.media?.title ??
    next.song?.title ??
    (next.scripture
      ? `${next.scripture.bookName} ${next.scripture.chapter}:${next.scripture.verse}`
      : undefined);
  return title ? { id: next.id, title } : null;
}

export function SongSlidesColumn() {
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const item =
    selectedItemId === null ? undefined : findEventItem(event, selectedItemId);

  if (item?.scripture) {
    return <ScriptureSlidesColumn item={item} />;
  }

  if (item?.media) {
    const part = event?.parts.find((candidate) =>
      candidate.items.some((candidateItem) => candidateItem.id === item.id),
    );
    return (
      <MediaSlidesColumn item={item} partId={part?.id ?? ""} />
    );
  }

  return <SongSlidesContent />;
}

function SongSlidesContent() {
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const songsCache = useSetlistStore((s) => s.songsCache);
  const runnerIndex = useSetlistStore((s) => s.runnerIndex);
  const loadItemSong = useSetlistStore((s) => s.loadItemSong);
  const projectSection = useSetlistStore((s) => s.projectSection);
  const selectItem = useSetlistStore((s) => s.selectItem);
  const groups = useSongGroupsStore((s) => s.groups);
  const addEmptySlideAtStart = useSongDefaultsStore(
    (s) => s.addEmptySlideAtStart,
  );
  const [viewMode, setViewMode] = usePersistentViewMode(
    "open_presenter_setlist_song_view",
    "list",
    ["list", "slides", "text"] as const,
  );
  const [gridZoom, setGridZoom] = usePersistentNumber(
    "open_presenter_setlist_song_zoom",
    SONG_PREVIEW_GRID.defaultLevel,
    SONG_PREVIEW_GRID.minLevel,
    SONG_PREVIEW_GRID.maxLevel,
  );
  const resolveTheme = usePublicThemeResolver();

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewIndexRef = useRef<number | null>(null);
  const [numberBuffer, setNumberBuffer] = useState("");
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlide, setDragOverSlide] = useState<{
    index: number;
    position: "before" | "after";
  } | null>(null);
  const dragSlideRef = useRef<number | null>(null);

  const item =
    selectedItemId === null ? undefined : findEventItem(event, selectedItemId);
  const song =
    item !== undefined && item.song != null && item.songId != null
      ? songsCache[item.songId]
      : undefined;

  useEffect(() => {
    if (item !== undefined && item.song != null && song === undefined) {
      void loadItemSong(item.id);
    }
  }, [item, song, loadItemSong]);

  const slides = useMemo(
    () =>
      song === undefined
        ? []
        : buildSongSlides(song, { addEmptySlideAtStart }),
    [song, addEmptySlideAtStart],
  );
  const thumbnailThemes = useMemo(
    () =>
      new Map(
        slides.map((slide) => [slide.slide.id, resolveTheme(slide.slide)]),
      ),
    [slides, resolveTheme],
  );
  const slideGroups = computeSlideGroups(slides);
  const nextItem = resolveNextItem(item, event);

  const live = usePresentationStore((s) => s.live);
  const isPresentationActive =
    runnerIndex !== null &&
    !live.cleared &&
    !live.blackout &&
    live.content.kind !== "blank";

  const labeledGroups = slideGroups.filter((g) => g.label !== null);
  const previousAddEmptySlideAtStart = useRef(addEmptySlideAtStart);

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

  useEffect(() => {
    const previous = previousAddEmptySlideAtStart.current;
    previousAddEmptySlideAtStart.current = addEmptySlideAtStart;
    if (previous === addEmptySlideAtStart) return;

    setPreviewIndex((current) => {
      if (current === null) return null;
      if (slides.length === 0) {
        usePresentationStore.getState().setPreview(null);
        return null;
      }
      const delta = addEmptySlideAtStart ? 1 : -1;
      const nextIdx = Math.max(
        0,
        Math.min(slides.length - 1, current + delta),
      );
      usePresentationStore.getState().setPreview(slides[nextIdx]?.slide ?? null);
      return nextIdx;
    });
  }, [addEmptySlideAtStart, slides]);

  // Keyboard navigation: ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter and Escape
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

      if (slides.length === 0 || !item) return;

      const live = usePresentationStore.getState().live;
      const currentRunnerIdx = useSetlistStore.getState().runnerIndex;
      const isPresentationActive =
        currentRunnerIdx !== null &&
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
        if (isPresentationActive || currentRunnerIdx !== null || !live.cleared) {
          e.preventDefault();
          void usePresentationStore.getState().clearLive();
          useSetlistStore.setState({ runnerIndex: null });
        }
        return;
      }

      if (isSlideNumberKey(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setNumberBuffer(appendSlideNumberDigit(numberBuffer, e.key));
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
        e.preventDefault();
        if (numberBuffer.length > 0) {
          const targetIdx = resolveSlideNumberIndex(numberBuffer, slides.length);
          setNumberBuffer("");
          if (targetIdx !== null) {
            setPreviewIndex(targetIdx);
            usePresentationStore.getState().setPreview(slides[targetIdx]?.slide ?? null);
            if (isPresentationActive) {
              void projectSection(item.id, targetIdx);
            }
            slideRefs.current[targetIdx]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }
          return;
        }
        if (previewIndex !== null) {
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
  }, [slides, item, previewIndex, projectSection, numberBuffer]);

  useEffect(() => {
    previewIndexRef.current = previewIndex;
  }, [previewIndex]);

  // Atalhos de seção são contextuais e têm prioridade sobre os atalhos
  // globais (B/C/F) quando há uma música com seções na coluna de letras.
  useEffect(() => {
    function handleGroupShortcut(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key.length !== 1) return;

      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        target?.closest(
          '[role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper]',
        )
      ) {
        return;
      }
      if (!sectionRef.current?.contains(document.activeElement)) return;
      if (slides.length === 0 || !item) return;

      const pressedChar = e.key.toUpperCase();
      const matchingGroup = useSongGroupsStore
        .getState()
        .groups.find(
          (group) => group.shortcut && group.shortcut.toUpperCase() === pressedChar,
        );
      if (!matchingGroup) return;

      const targetIndices: number[] = [];
      slides.forEach((slide, index) => {
        const matchesType =
          matchingGroup.typeKey && slide.sectionType === matchingGroup.typeKey;
        const matchesLabel =
          slide.label &&
          slide.label.toLowerCase().includes(matchingGroup.name.toLowerCase());
        const matchesSection =
          slide.slide.section &&
          slide.slide.section.toLowerCase().includes(matchingGroup.name.toLowerCase());
        if (matchesType || matchesLabel || matchesSection) {
          targetIndices.push(index);
        }
      });
      if (targetIndices.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const currentRunnerIdx = useSetlistStore.getState().runnerIndex;
      const live = usePresentationStore.getState().live;
      const isPresentationActive =
        currentRunnerIdx !== null &&
        !live.cleared &&
        !live.blackout &&
        live.content.kind !== "blank";
      const currentIdx = currentRunnerIdx ?? previewIndexRef.current ?? -1;
      const posInMatches = targetIndices.indexOf(currentIdx);
      const nextTargetIdx =
        posInMatches >= 0
          ? targetIndices[(posInMatches + 1) % targetIndices.length]
          : targetIndices[0];

      previewIndexRef.current = nextTargetIdx;
      setPreviewIndex(nextTargetIdx);
      usePresentationStore
        .getState()
        .setPreview(slides[nextTargetIdx]?.slide ?? null);
      if (isPresentationActive) {
        void projectSection(item.id, nextTargetIdx);
      }
      slideRefs.current[nextTargetIdx]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }

    window.addEventListener("keydown", handleGroupShortcut, true);
    return () => window.removeEventListener("keydown", handleGroupShortcut, true);
  }, [slides, item, projectSection]);

  function resolveGroupBadge(group: SlideGroup) {
    const groupConfig = findSongGroup(groups, group.sectionType, group.label);
    return {
      groupConfig,
      badgeBg: songGroupColor(groups, group.sectionType, group.label),
    };
  }

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

  async function handleRemoveSectionLabel(sectionIndex: number) {
    if (!song || !item) return;
    const updatedSections = song.sections.map((sec, idx) =>
      idx === sectionIndex ? { ...sec, sectionType: null } : sec
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
      console.error("Erro ao remover rótulo:", err);
    }
  }

  async function handleSplitSection(sectionIndex: number, linesPerSlide: 1 | 2) {
    if (!song || !item) return;
    const target = song.sections[sectionIndex];
    if (!target || target.lines.length <= linesPerSlide) return;

    const newSections = splitSection(target, linesPerSlide);

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
    const source = slides[sourceIndex]?.sectionIndex;
    const target = slides[targetIndex]?.sectionIndex;
    if (
      source === null ||
      source === undefined ||
      target === null ||
      target === undefined ||
      source === target
    ) {
      return;
    }

    const sections = [...song.sections];
    const [moved] = sections.splice(source, 1);
    if (!moved) return;

    let destIndex = target;
    if (position === "before") {
      destIndex = source < target ? target - 1 : target;
    } else {
      destIndex = source < target ? target : target + 1;
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

  function renderSlideCard(
    block: RunnerSlide,
    group: SlideGroup,
    positionInGroup: number,
  ) {
    const isLive = runnerIndex === block.index;
    const isPreview = previewIndex === block.index;
    const isBeingDragged =
      (dragSlideRef.current ?? draggedSlideIndex) === block.index;
    const isHoveredOver = dragOverSlide?.index === block.index;
    const editSectionIndex = block.sectionIndex;
    const canEditSection = editSectionIndex !== null && !block.isBlank;
    const dense = viewMode !== "list";
    const { badgeBg: groupColor } = resolveGroupBadge(group);

    return (
        <div
          key={block.index}
          className={
            viewMode !== "list"
              ? "min-w-0 rounded-lg border border-border/60 bg-card/40"
              : positionInGroup > 0
              ? "border-t border-border/25"
              : undefined
          }
        >
          <ContextMenu modal={false}>
            <ContextMenuTrigger asChild>
              <div
                ref={(el) => {
                  slideRefs.current[block.index] = el;
                }}
                draggable={canEditSection}
                onDragStart={(e) => {
                  if (!canEditSection) return;
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
                  const assetPayload = readAssetPayload(e.dataTransfer);
                  if (assetPayload) {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = resolveApplyTarget("public");
                    if (target) handleAssetDrop(e, target);
                    return;
                  }
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
                className={`group relative flex flex-col transition-all outline-none select-none ${
                  viewMode === "list"
                    ? "gap-2 p-3.5"
                    : "gap-1.5 p-2"
                } ${
                  canEditSection
                    ? "cursor-grab active:cursor-grabbing"
                    : ""
                } ${
                  isLive
                    ? "bg-emerald-500/15 ring-2 ring-inset ring-emerald-500/60 shadow-xs"
                    : isPreview
                    ? "bg-primary/15 ring-2 ring-inset ring-primary/40 shadow-2xs"
                    : "bg-card/40 hover:bg-accent/40"
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
                {/* Card Sub-Header: Indicador de Parte (se múltiplos slides) & Badges de Status */}                                <div className="flex min-w-0 items-center justify-between gap-1 min-h-[16px]">
                                  <div className="flex min-w-0 items-center gap-1">
                                    {dense && group.label && (
                                      <span
                                        className="truncate rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                                        style={{
                                          backgroundColor: groupColor ?? "#3b82f6",
                                        }}
                                      >
                                        {group.label}
                                      </span>
                                    )}
                                    {group.indices.length > 1 && (
                                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60">
                                        Parte {positionInGroup + 1}
                                      </span>
                                    )}
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

                {/* Lyrics Text Preview / Themed thumbnail */}
                {viewMode === "slides" ? (
                  <div className="relative">
                    <SlideThumbnail
                      content={block.slide}
                      theme={
                        thumbnailThemes.get(block.slide.id) ??
                        null
                      }
                      className="pointer-events-none"
                    />
                    {block.isBlank && (
                      <Badge
                        variant="outline"
                        className="pointer-events-none absolute left-1.5 top-1.5 border-white/20 bg-black/60 text-[9px] font-medium text-white"
                      >
                        Slide vazio
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {block.slide.lines.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground/60">
                        (Slide vazio)
                      </p>
                    ) : (
                      block.slide.lines.map((line, lIdx) => (
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
                      ))
                    )}
                  </div>
                )}

                {/* Bottom indicator hint */}
                <div className="flex min-w-0 items-center justify-between gap-1 text-[10px] text-muted-foreground/60">
                  <span className="truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {isLive ? "Transmitindo no telão" : "Duplo clique para apresentar"}
                  </span>
                  <span className="tabular-nums font-mono text-[9px]">
                    #{block.index + 1}
                  </span>
                </div>
              </div>
            </ContextMenuTrigger>

          <ContextMenuContent
            className="w-52"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {/* 1. Editar */}
            <ContextMenuItem onClick={() => handleEditSong()}>
              <Pencil className="size-3.5 mr-2" />
              <span>Editar Música</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* 2. Rótulo > */}
            <ContextMenuSub>
              <ContextMenuSubTrigger disabled={!canEditSection}>
                <Tag className="size-3.5 mr-2" />
                <span>Rótulo</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {(Object.entries(SECTION_LABEL) as [SectionType, string][]).map(
                  ([typeKey, typeLabel]) => (
                    <ContextMenuItem
                      key={typeKey}
                      disabled={!canEditSection}
                      onClick={() => {
                        if (editSectionIndex === null) return;
                        void handleUpdateSectionLabel(
                          editSectionIndex,
                          typeKey,
                        );
                      }}
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
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={!canEditSection}
                  onClick={() => {
                    if (editSectionIndex === null) return;
                    void handleRemoveSectionLabel(editSectionIndex);
                  }}
                  className="text-xs text-muted-foreground"
                >
                  Remover rótulo
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            {/* 3. Dividir > */}
            <ContextMenuSub>
              <ContextMenuSubTrigger disabled={!canEditSection}>
                <Split className="size-3.5 mr-2" />
                <span>Dividir</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem
                  disabled={
                    !canEditSection ||
                    block.slide.lines.length <= 2
                  }
                  onClick={() => {
                    if (editSectionIndex === null) return;
                    void handleSplitSection(editSectionIndex, 2);
                  }}
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
                  disabled={
                    !canEditSection ||
                    block.slide.lines.length <= 1
                  }
                  onClick={() => {
                    if (editSectionIndex === null) return;
                    void handleSplitSection(editSectionIndex, 1);
                  }}
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
      </div>
    );
  }

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement | null;
        if (
          target?.closest(
            "button, a, input, textarea, select, [role='button'], [contenteditable='true']",
          )
        ) {
          return;
        }
        sectionRef.current?.focus({ preventScroll: true });
      }}
      onContextMenu={(e) => {
        // Prevent default browser context menu throughout column
        e.preventDefault();
      }}
      onClick={() => setNumberBuffer("")}
      className="relative flex h-full w-full min-w-0 flex-col border-r border-border bg-background select-none overflow-hidden outline-none"
    >
      {/* Top Header with increased padding top & bottom */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
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
          <div className="flex shrink-0 items-center gap-1.5">
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
          </div>
        )}
      </div>

      {/* Barra de Previews: modo (lista/slides/texto) e densidade */}
      {item && slides.length > 0 && (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/20 px-3">
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "list", label: "Lista", icon: List },
              { value: "slides", label: "Slides", icon: LayoutGrid },
              { value: "text", label: "Texto", icon: AlignLeft },
            ]}
          />
          {viewMode !== "list" && (
            <PreviewZoomControls
              config={SONG_PREVIEW_GRID}
              level={gridZoom}
              onChange={setGridZoom}
            />
          )}
        </div>
      )}

      {/* Barra Rápida de Seções / Atalhos de Grupos */}
      {item && labeledGroups.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border/70 bg-muted/30 px-3 py-1.5 overflow-x-auto [scrollbar-width:none]">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            Ir para:
          </span>
          <div className="flex items-center gap-1">
            {labeledGroups.map((g) => {
              const firstSlide = slides[g.startIndex];
              const { groupConfig, badgeBg } = resolveGroupBadge(g);
              const chipColor = badgeBg ?? "#3b82f6";
              const isSelected =
                previewIndex !== null && g.indices.includes(previewIndex);
              const isCurrentLive =
                runnerIndex !== null && g.indices.includes(runnerIndex);

              return (
                <button
                  key={g.startIndex}
                  type="button"
                  onClick={() => {
                    setPreviewIndex(g.startIndex);
                    usePresentationStore
                      .getState()
                      .setPreview(firstSlide?.slide ?? null);
                    if (isPresentationActive) {
                      void projectSection(item.id, g.startIndex);
                    }
                    slideRefs.current[g.startIndex]?.scrollIntoView({
                      block: "nearest",
                      behavior: "smooth",
                    });
                  }}
                  onDoubleClick={() => {
                    handlePresent(g.startIndex);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer shrink-0 border ${
                    isCurrentLive
                      ? "ring-2 ring-emerald-500 shadow-xs font-bold"
                      : isSelected
                      ? "ring-2 ring-primary/40 shadow-2xs"
                      : "opacity-85 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: `${chipColor}22`,
                    borderColor: `${chipColor}88`,
                    color: chipColor,
                  }}
                  title={`Ir para ${g.label}${
                    groupConfig?.shortcut ? ` (tecla ${groupConfig.shortcut})` : ""
                  }`}
                >
                  <span>{g.label}</span>
                  {groupConfig?.shortcut && (
                    <kbd className="rounded bg-black/20 dark:bg-white/20 px-1 py-0.2 font-mono text-[8px] font-bold">
                      {groupConfig.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {item && song && labeledGroups.length === 0 && slides.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <span className="truncate">Música sem seções definidas (Verso, Refrão...)</span>
          <button
            type="button"
            onClick={handleEditSong}
            className="ml-2 font-medium underline hover:no-underline shrink-0 cursor-pointer"
          >
            Editar seções
          </button>
        </div>
      )}

      {/* Slides Cards List (Scrollable with persistent native scrollbar) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 [scrollbar-gutter:stable]">
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
          ) : viewMode !== "list" ? (
            <div
              className="grid gap-2"
              style={previewGridStyle(SONG_PREVIEW_GRID, gridZoom)}
            >
              {slides.map((block) => {
                const group =
                  slideGroups.find((entry) => entry.indices.includes(block.index)) ??
                  slideGroups[0];
                const positionInGroup = group.indices.indexOf(block.index);
                return renderSlideCard(block, group, positionInGroup);
              })}
            </div>
          ) : (
            slideGroups.map((group) => {
              const { groupConfig, badgeBg: groupColor } =
                resolveGroupBadge(group);
              const isLabeled = group.label !== null;

              return (
                <div
                  key={group.startIndex}
                  className={`overflow-hidden rounded-xl border transition-all ${
                    isLabeled ? "" : "border-border/60 bg-muted/20"
                  }`}
                  style={
                    isLabeled && groupColor
                      ? {
                          borderColor: `${groupColor}66`,
                          backgroundColor: `${groupColor}08`,
                        }
                      : undefined
                  }
                >
                  {/* Cabeçalho Único do Grupo: Rótulo da Seção, Atalho e Quantidade de Slides */}
                  <div
                    className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/30 select-none"
                    style={
                      isLabeled && groupColor
                        ? { borderBottomColor: `${groupColor}25` }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      {isLabeled ? (
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase shadow-2xs text-white flex items-center gap-1.5"
                          style={{ backgroundColor: groupColor ?? "#3b82f6" }}
                        >
                          <span>{group.label}</span>
                          {groupConfig?.shortcut && (
                            <kbd className="rounded bg-black/25 px-1 py-0.2 font-mono text-[9px] font-bold">
                              {groupConfig.shortcut}
                            </kbd>
                          )}
                        </span>
                      ) : group.isBlank ? (
                        <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium italic text-muted-foreground">
                          Slide vazio
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic">
                          Sem grupo
                        </span>
                      )}
                    </div>

                    {group.indices.length > 1 && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        {group.indices.length} slides
                      </span>
                    )}
                  </div>

                  {/* Lista de Slides Pertencentes ao Grupo */}
                  <div>
                    {group.indices.map((slideIndex, positionInGroup) =>
                      renderSlideCard(slides[slideIndex], group, positionInGroup),
                    )}
                  </div>
                </div>
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
      <SlideNumberIndicator buffer={numberBuffer} />
    </section>
  );
}
