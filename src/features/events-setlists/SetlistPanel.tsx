import { Fragment, useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/core/lib/utils";
import type { EventItem, EventPart } from "@/core/types";
import { useSongsStore } from "@/features/songs/store";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { SongPickerDialog } from "./SongPickerDialog";
import { useSetlistStore } from "./store";

export function SetlistPanel() {
  const events = useSetlistStore((s) => s.events);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const event = useSetlistStore((s) => s.event);
  const dirty = useSetlistStore((s) => s.dirty);
  const error = useSetlistStore((s) => s.error);
  const load = useSetlistStore((s) => s.load);
  const selectEvent = useSetlistStore((s) => s.selectEvent);
  const createEvent = useSetlistStore((s) => s.createEvent);
  const deleteEvent = useSetlistStore((s) => s.deleteEvent);
  const renameEvent = useSetlistStore((s) => s.renameEvent);
  const addPart = useSetlistStore((s) => s.addPart);
  const save = useSetlistStore((s) => s.save);

  const [creating, setCreating] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLinkedTheme, setDeleteLinkedTheme] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setConfirmDelete(false);
    setDeleteLinkedTheme(false);
  }, [activeEventId]);

  const handleCreate = () => {
    const title = newEventTitle.trim();
    if (title === "") return;
    setNewEventTitle("");
    setCreating(false);
    void createEvent(title);
  };

  const handleDelete = async () => {
    if (event === null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const linkedTheme = event.themeGuid ?? null;
    const shouldDeleteTheme = deleteLinkedTheme;
    setConfirmDelete(false);
    setDeleteLinkedTheme(false);
    await deleteEvent(event.id);
    if (shouldDeleteTheme && linkedTheme) {
      await useSlideThemesStore.getState().remove(linkedTheme);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ordem do culto (Setlist)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={activeEventId ?? ""}
            onValueChange={(value) => void selectEvent(value)}
          >
            <SelectTrigger className="min-w-44 flex-1">
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent position="popper">
              {events.map((summary) => (
                <SelectItem key={summary.id} value={summary.id}>
                  {summary.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            ＋ evento
          </Button>
          <Button
            size="sm"
            disabled={!dirty || event === null}
            onClick={() => void save()}
          >
            Salvar
          </Button>
          {dirty && <Badge variant="outline">não salvo</Badge>}
          {event !== null && (
            <Button
              size="sm"
              variant={confirmDelete ? "destructive" : "outline"}
              onClick={() => void handleDelete()}
            >
              {confirmDelete ? "Confirmar?" : "Excluir evento"}
            </Button>
          )}
          {confirmDelete && event?.themeGuid && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={deleteLinkedTheme}
                onChange={(e) => setDeleteLinkedTheme(e.target.checked)}
                className="size-3.5 accent-destructive"
              />
              Excluir tema junto
            </label>
          )}
        </div>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        {event === null && (
          <p className="text-sm text-muted-foreground">
            Selecione ou crie um evento.
          </p>
        )}
        {event !== null && (
          <>
            <Input
              value={event.title}
              placeholder="Título do evento"
              aria-label="Título do evento"
              onChange={(e) => renameEvent(e.target.value)}
            />
            <Separator />
            <div className="flex flex-col gap-3">
              {event.parts.map((part, index) => (
                <PartBlock
                  key={part.id}
                  part={part}
                  index={index}
                  count={event.parts.length}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addPart("Nova parte")}
              >
                ＋ parte
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) setNewEventTitle("");
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Novo evento</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Título do evento"
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button disabled={newEventTitle.trim() === ""} onClick={handleCreate}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface PartBlockProps {
  part: EventPart;
  index: number;
  count: number;
}

function PartBlock({ part, index, count }: PartBlockProps) {
  const renamePart = useSetlistStore((s) => s.renamePart);
  const removePart = useSetlistStore((s) => s.removePart);
  const movePart = useSetlistStore((s) => s.movePart);

  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Card className="gap-3 py-3">
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex items-center gap-1">
          <Input
            value={part.title}
            placeholder="Título da parte"
            aria-label="Título da parte"
            onChange={(e) => renamePart(part.id, e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mover parte para cima"
            disabled={index === 0}
            onClick={() => movePart(part.id, -1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mover parte para baixo"
            disabled={index === count - 1}
            onClick={() => movePart(part.id, 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remover parte"
            onClick={() => removePart(part.id)}
          >
            <Trash2 />
          </Button>
        </div>
        {part.items.length > 0 && (
          <div className="flex flex-col gap-1">
            {part.items.map((item, itemIndex) => (
              <ItemRow
                key={item.id}
                item={item}
                index={itemIndex}
                count={part.items.length}
              />
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
        >
          ＋ música
        </Button>
        <SongPickerDialog
          partId={part.id}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />
      </CardContent>
    </Card>
  );
}

interface ItemRowProps {
  item: EventItem;
  index: number;
  count: number;
}

function ItemRow({ item, index, count }: ItemRowProps) {
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const selectItem = useSetlistStore((s) => s.selectItem);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const moveItem = useSetlistStore((s) => s.moveItem);
  const setNextItem = useSetlistStore((s) => s.setNextItem);

  const nextOptions = (event?.parts ?? [])
    .map((part) => ({
      part,
      items: part.items.filter((other) => other.id !== item.id),
    }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="flex items-center gap-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant="secondary"
            className={cn(
              "min-w-0 flex-1 justify-start",
              selectedItemId === item.id && "ring-1 ring-primary",
              item.song == null && item.media == null && "text-muted-foreground",
            )}
            onClick={() => selectItem(item.id)}
          >
            <span className="min-w-0 truncate">
              {item.media
                ? item.media.title
                : item.song
                ? `${item.song.title} · ${item.song.artist}`
                : "Música removida"}
            </span>
            {item.nextItemId !== null && (
              <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            )}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={item.songId == null}
            onClick={() => {
              if (item.songId) {
                void useSongsStore.getState().editSong(item.songId);
              }
            }}
          >
            Editar
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => removeItem(item.id)}
          >
            Remover
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Definir a próxima música</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {nextOptions.map(({ part, items }) => (
                <Fragment key={part.id}>
                  <ContextMenuLabel>{part.title}</ContextMenuLabel>
                  {items.map((other) => (
                    <ContextMenuItem
                      key={other.id}
                      onClick={() => setNextItem(item.id, other.id)}
                    >
                      {other.song?.title ?? "Música removida"}
                    </ContextMenuItem>
                  ))}
                </Fragment>
              ))}
              {nextOptions.length > 0 && <ContextMenuSeparator />}
              <ContextMenuItem onClick={() => setNextItem(item.id, null)}>
                Nenhuma
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Mover música para cima"
        disabled={index === 0}
        onClick={() => moveItem(item.id, -1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Mover música para baixo"
        disabled={index === count - 1}
        onClick={() => moveItem(item.id, 1)}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
