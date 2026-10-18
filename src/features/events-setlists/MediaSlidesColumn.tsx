import { useEffect, useMemo, useState } from "react";
import {
  AlignLeft,
  Eye,
  Images,
  Image as ImageIcon,
  Pencil,
  Play,
  Radio,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mediaKindLabel } from "@/core/lib/media";
import { buildMediaSlides } from "@/core/lib/media";
import type { EventItem, MediaKind } from "@/core/types";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { usePresentationStore } from "@/features/presentation/store";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import { MediaDialog } from "./MediaDialog";
import { TextEditorDialog } from "./TextEditorDialog";
import { useSetlistStore } from "./store";

const KIND_ICON: Record<MediaKind, typeof AlignLeft> = {
  text: AlignLeft,
  image: ImageIcon,
  folder: Images,
  video: Video,
};

export function MediaSlidesColumn({
  item,
  partId,
}: {
  item: EventItem;
  partId: string;
}) {
  const media = item.media;
  const slides = useMemo(
    () => (media ? buildMediaSlides(item.id, media) : []),
    [item.id, media],
  );
  const runnerIndex = useSetlistStore((s) => s.runnerIndex);
  const projectSection = useSetlistStore((s) => s.projectSection);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const save = useSetlistStore((s) => s.save);
  const base = useMediaBaseUrl();

  const [previewIndex, setPreviewIndex] = useState(0);
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

      if (e.key === "Escape") {
        e.preventDefault();
        void usePresentationStore.getState().clearLive();
        useSetlistStore.setState({ runnerIndex: null });
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
        void projectSection(item.id, previewIndex);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item.id, previewIndex, projectSection, runnerIndex, slides]);

  if (!media) return null;

  const Icon = KIND_ICON[media.kind];
  const fileCount = media.files?.length ?? 0;
  const isFolder = media.kind === "folder";
  const isText = media.kind === "text";

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
    <section className="flex h-full w-80 min-h-0 flex-col border-r border-border bg-background sm:w-96 shrink-0 select-none overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-xs text-foreground">
              {media.title}
            </p>
            <p className="truncate text-[11px] text-muted-foreground mt-0.5">
              {mediaKindLabel(media.kind)}
              {isFolder ? ` · ${fileCount} imagens` : ""}
              {isText && slides.length > 1 ? ` · ${slides.length} textos` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            title="Editar mídia"
            onClick={() => {
              if (media.kind === "text") setTextEditOpen(true);
              else setEditOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
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
            size="sm"
            variant="default"
            disabled={slides.length === 0}
            className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs transition-all active:scale-95"
            onClick={() => handlePresent()}
            title="Apresentar mídia para o público (Enter)"
          >
            <Play className="size-3.5 fill-current" />
            Apresentar
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 [scrollbar-gutter:stable]">
        {slides.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
            <Icon className="size-8 opacity-50" />
            <p className="font-semibold text-foreground">
              {isText
                ? "Nenhum texto"
                : isFolder
                ? "Nenhuma imagem"
                : "Nenhuma mídia"}
            </p>
            <p className="max-w-[220px] text-[11px]">
              {isText
                ? "Edite esta mídia e escreva um ou mais textos."
                : isFolder
                ? "Edite esta mídia e escolha uma pasta com imagens para exibir."
                : "Edite esta mídia e escolha o arquivo para exibir."}
            </p>
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
    </section>
  );
}
