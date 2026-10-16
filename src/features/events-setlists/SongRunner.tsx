import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SECTION_COLOR } from "@/core/config/lyrics";
import { buildSongSlides, type RunnerSlide } from "@/core/lib/lyrics";
import { cn } from "@/core/lib/utils";
import type { EventItem, ServiceEvent } from "@/core/types";
import { usePresentationStore } from "@/features/presentation/store";
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

export function SongRunner() {
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const songsCache = useSetlistStore((s) => s.songsCache);
  const runnerIndex = useSetlistStore((s) => s.runnerIndex);
  const loadItemSong = useSetlistStore((s) => s.loadItemSong);
  const projectSection = useSetlistStore((s) => s.projectSection);
  const projectNext = useSetlistStore((s) => s.projectNext);
  const projectPrev = useSetlistStore((s) => s.projectPrev);
  const selectItem = useSetlistStore((s) => s.selectItem);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Letra do culto</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {item === undefined && (
          <p className="text-sm text-muted-foreground">
            Selecione uma música no setlist.
          </p>
        )}
        {item !== undefined && item.song === null && (
          <p className="text-sm text-amber-500">
            Música removida — escolha outra no setlist.
          </p>
        )}
        {item !== undefined && item.song !== null && song === undefined && (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
        {item !== undefined && song !== undefined && (
          <>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
              {slides.map((block) => (
                <RunnerBlock
                  key={block.index}
                  block={block}
                  active={runnerIndex === block.index}
                  onProject={() => void projectSection(item.id, block.index)}
                />
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={runnerIndex === null || runnerIndex === 0}
                onClick={() => void projectPrev()}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={runnerIndex !== null && runnerIndex >= slides.length - 1}
                onClick={() => void projectNext()}
              >
                Próximo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void usePresentationStore.getState().clearLive();
                  useSetlistStore.setState({ runnerIndex: null });
                }}
              >
                Limpar
              </Button>
              {nextItem !== null && runnerIndex === slides.length - 1 && (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    selectItem(nextItem.id);
                    void projectSection(nextItem.id, 0);
                  }}
                >
                  Ir para {nextItem.title}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface RunnerBlockProps {
  block: RunnerSlide;
  active: boolean;
  onProject(): void;
}

function RunnerBlock({ block, active, onProject }: RunnerBlockProps) {
  const color =
    block.sectionType === null ? null : SECTION_COLOR[block.sectionType];
  const preview = block.slide.lines.slice(0, 2).join("\n");

  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onProject}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      <Badge
        variant="outline"
        className={cn("self-start", color === null && "text-muted-foreground")}
        style={
          color === null
            ? undefined
            : { backgroundColor: color, borderColor: color, color: "#fff" }
        }
      >
        {block.label ?? "—"}
      </Badge>
      <span className="line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
        {preview}
      </span>
    </button>
  );
}
