import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  FolderPlus,
  GripVertical,
  MoreVertical,
  Music,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSongsStore } from "@/features/songs/store";
import { useSetlistStore } from "./store";
import { SongPickerDialog } from "./SongPickerDialog";

export function SetlistSidebar() {
  const events = useSetlistStore((s) => s.events);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const selectItem = useSetlistStore((s) => s.selectItem);
  const selectEvent = useSetlistStore((s) => s.selectEvent);
  const createEvent = useSetlistStore((s) => s.createEvent);
  const deleteEvent = useSetlistStore((s) => s.deleteEvent);
  const addPart = useSetlistStore((s) => s.addPart);
  const removePart = useSetlistStore((s) => s.removePart);
  const movePart = useSetlistStore((s) => s.movePart);
  const reorderParts = useSetlistStore((s) => s.reorderParts);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const moveItem = useSetlistStore((s) => s.moveItem);
  const reorderItem = useSetlistStore((s) => s.reorderItem);
  const save = useSetlistStore((s) => s.save);
  const dirty = useSetlistStore((s) => s.dirty);

  const [searchQuery, setSearchQuery] = useState("");
  const [pickerPartId, setPickerPartId] = useState<string | null>(null);
  const [newPartDialogOpen, setNewPartDialogOpen] = useState(false);
  const [newPartTitle, setNewPartTitle] = useState("");
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");

  // Drag and drop state
  const [draggedPartIndex, setDraggedPartIndex] = useState<number | null>(null);
  const [dragOverPartIndex, setDragOverPartIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ partId: string; itemId: string; index: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ partId: string; itemId: string; position: "before" | "after" } | null>(null);

  const dragItemRef = useRef<{ partId: string; itemId: string; index: number } | null>(null);
  const dragPartRef = useRef<number | null>(null);

  const needle = searchQuery.trim().toLowerCase();

  function handleCreatePart() {
    if (!newPartTitle.trim()) return;
    addPart(newPartTitle.trim());
    setNewPartTitle("");
    setNewPartDialogOpen(false);
    void save();
  }

  function handleCreateEvent() {
    if (!newEventTitle.trim()) return;
    void createEvent(newEventTitle.trim());
    setNewEventTitle("");
    setNewEventDialogOpen(false);
  }

  function handleDropOnItem(
    e: React.DragEvent,
    targetPartId: string,
    targetItemId: string,
    targetIndex: number,
    position: "before" | "after",
  ) {
    e.preventDefault();
    e.stopPropagation();

    const source = dragItemRef.current || draggedItem;
    if (!source || source.itemId === targetItemId) {
      dragItemRef.current = null;
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    let destIndex = targetIndex;
    if (source.partId === targetPartId) {
      if (position === "before") {
        destIndex = source.index < targetIndex ? targetIndex - 1 : targetIndex;
      } else {
        destIndex = source.index < targetIndex ? targetIndex : targetIndex + 1;
      }
    } else {
      destIndex = position === "before" ? targetIndex : targetIndex + 1;
    }

    reorderItem(source.partId, source.index, targetPartId, destIndex);
    dragItemRef.current = null;
    setDraggedItem(null);
    setDragOverItem(null);
    void save();
  }

  function handleDropOnEmptyPart(e: React.DragEvent, targetPartId: string) {
    e.preventDefault();
    e.stopPropagation();

    const source = dragItemRef.current || draggedItem;
    if (!source) return;

    reorderItem(source.partId, source.index, targetPartId, 0);
    dragItemRef.current = null;
    setDraggedItem(null);
    setDragOverItem(null);
    void save();
  }

  function handleDropOnPartHeader(e: React.DragEvent, targetPartIdx: number) {
    e.preventDefault();
    e.stopPropagation();

    const srcIdx = dragPartRef.current ?? draggedPartIndex;
    if (srcIdx !== null && srcIdx !== targetPartIdx) {
      reorderParts(srcIdx, targetPartIdx);
      void save();
    }
    dragPartRef.current = null;
    setDraggedPartIndex(null);
    setDragOverPartIndex(null);
  }

  function handleAddMusic(targetPartId?: string) {
    if (!event) return;
    if (targetPartId) {
      setPickerPartId(targetPartId);
      return;
    }
    if (event.parts.length === 0) {
      const newPartId = addPart("Louvor");
      setPickerPartId(newPartId);
      void save();
    } else {
      setPickerPartId(event.parts[0].id);
    }
  }

  const totalItems = event?.parts.reduce((acc, p) => acc + p.items.length, 0) ?? 0;

  return (
    <aside className="flex h-full w-72 min-h-0 flex-col border-r border-border bg-muted/20 sm:w-80 shrink-0 select-none overflow-hidden">
      {/* Top Header: Event Title & Action Plus */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-left font-bold text-sm tracking-tight text-foreground hover:text-primary transition-colors outline-none"
            >
              <span className="truncate max-w-[180px]">
                {event?.title || "Programação do Culto"}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cultos & Eventos
            </div>
            {events.map((ev) => (
              <DropdownMenuItem
                key={ev.id}
                onSelect={() => void selectEvent(ev.id)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{ev.title}</span>
                </div>
                {ev.id === activeEventId && (
                  <Check className="size-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setNewEventDialogOpen(true)}
              className="text-xs"
            >
              <Plus className="size-3.5 mr-2" />
              Novo Culto / Evento…
            </DropdownMenuItem>
            {event && (
              <DropdownMenuItem
                onSelect={() => void deleteEvent(event.id)}
                className="text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" />
                Excluir este evento
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Plus Action Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-lg border-border/80 shadow-2xs hover:bg-accent"
              aria-label="Adicionar item"
            >
              <Plus className="size-4 text-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={() => handleAddMusic()}
              className="text-xs cursor-pointer"
            >
              <Music className="size-3.5 mr-2 text-primary" />
              Adicionar Música
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setNewPartDialogOpen(true)}
              className="text-xs cursor-pointer"
            >
              <FolderPlus className="size-3.5 mr-2 text-primary" />
              Adicionar Seção
            </DropdownMenuItem>
            {dirty && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void save()}
                  className="text-xs font-semibold text-primary cursor-pointer"
                >
                  <Check className="size-3.5 mr-2" />
                  Salvar Programação
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search Input Bar */}
      <div className="border-b border-border/60 p-3 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar música na programação…"
            className="h-8 w-full rounded-md border border-input bg-background pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground shadow-2xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Programação Items List with Background Context Menu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-4 [scrollbar-gutter:stable]">
            {!event || totalItems === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 p-4 text-center select-none">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 border border-border/80 text-muted-foreground shadow-2xs">
                  <Music className="size-6 opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    Nenhum item na programação
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-[210px] leading-relaxed">
                    Adicione músicas ou seções para montar a programação deste culto.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full max-w-[190px] pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs font-medium w-full cursor-pointer"
                    onClick={() => handleAddMusic()}
                  >
                    <Music className="size-3.5 mr-1.5" />
                    Adicionar Música
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium w-full cursor-pointer"
                    onClick={() => setNewPartDialogOpen(true)}
                  >
                    <FolderPlus className="size-3.5 mr-1.5" />
                    Adicionar Seção
                  </Button>
                </div>
              </div>
            ) : (
              event.parts.map((part, partIdx) => {
                const filteredItems = part.items.filter((item) => {
                  if (!needle) return true;
                  const title = item.song?.title?.toLowerCase() || "";
                  const artist = item.song?.artist?.toLowerCase() || "";
                  return title.includes(needle) || artist.includes(needle);
                });

                if (needle && filteredItems.length === 0) return null;

                return (
                  <div
                    key={part.id}
                    className="space-y-1.5 rounded-lg transition-all"
                  >
                    {/* Part Section Header (Draggable for entire section moving) */}
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        dragPartRef.current = partIdx;
                        setDraggedPartIndex(partIdx);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", `part:${partIdx}`);
                      }}
                      onDragEnd={() => {
                        dragPartRef.current = null;
                        setDraggedPartIndex(null);
                        setDragOverPartIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        if (dragPartRef.current !== null && dragPartRef.current !== partIdx) {
                          setDragOverPartIndex(partIdx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverPartIndex === partIdx) {
                          setDragOverPartIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (dragPartRef.current !== null) {
                          handleDropOnPartHeader(e, partIdx);
                        } else if (dragItemRef.current) {
                          handleDropOnEmptyPart(e, part.id);
                        }
                      }}
                      className={`group flex cursor-grab active:cursor-grabbing items-center justify-between rounded px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:bg-muted/40 transition-colors ${
                        draggedPartIndex === partIdx ? "opacity-35" : ""
                      } ${
                        dragOverPartIndex === partIdx ? "bg-primary/10 ring-2 ring-primary/40 rounded" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GripVertical className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                        <span className="truncate">{part.title}</span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setPickerPartId(part.id)}
                          className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Adicionar música nesta seção"
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={partIdx === 0}
                          onClick={() => movePart(part.id, -1)}
                          className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                          title="Mover seção para cima"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={partIdx === event.parts.length - 1}
                          onClick={() => movePart(part.id, 1)}
                          className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                          title="Mover seção para baixo"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePart(part.id)}
                          className="rounded p-0.5 hover:bg-muted text-destructive hover:text-destructive cursor-pointer"
                          title="Excluir seção"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Empty section drop target */}
                    {part.items.length === 0 && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => handleDropOnEmptyPart(e, part.id)}
                        className="rounded-lg border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground/70"
                      >
                        Arraste músicas para esta seção
                      </div>
                    )}

                    {/* Items in Part (Draggable + Right-Click Context Menu) */}
                    <div className="space-y-1">
                      {filteredItems.map((item, itemIdx) => {
                        const isSelected = selectedItemId === item.id;
                        const title = item.song?.title || "Música sem título";
                        const artist = item.song?.artist || "Louvor";
                        const isBeingDragged =
                          (dragItemRef.current?.itemId ?? draggedItem?.itemId) === item.id;
                        const isHoveredOver = dragOverItem?.itemId === item.id;

                        return (
                          <ContextMenu key={item.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  const actualIndex = part.items.findIndex((it) => it.id === item.id);
                                  const dragData = {
                                    partId: part.id,
                                    itemId: item.id,
                                    index: actualIndex >= 0 ? actualIndex : itemIdx,
                                  };
                                  dragItemRef.current = dragData;
                                  setDraggedItem(dragData);
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", item.id);
                                }}
                                onDragEnd={() => {
                                  dragItemRef.current = null;
                                  setDraggedItem(null);
                                  setDragOverItem(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = "move";
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const position: "before" | "after" =
                                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                                  setDragOverItem({
                                    partId: part.id,
                                    itemId: item.id,
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
                                    if (dragOverItem?.itemId === item.id) {
                                      setDragOverItem(null);
                                    }
                                  }
                                }}
                                onDrop={(e) => {
                                  const actualIndex = part.items.findIndex((it) => it.id === item.id);
                                  const position = dragOverItem?.position ?? "after";
                                  handleDropOnItem(
                                    e,
                                    part.id,
                                    item.id,
                                    actualIndex >= 0 ? actualIndex : itemIdx,
                                    position,
                                  );
                                }}
                                onClick={() => selectItem(item.id)}
                                onContextMenu={(e) => {
                                  e.stopPropagation();
                                }}
                                className={`group relative flex cursor-grab active:cursor-grabbing items-start justify-between rounded-lg border p-2.5 transition-all text-left ${
                                  isSelected
                                    ? "border-primary/60 bg-accent text-accent-foreground shadow-2xs ring-1 ring-primary/40"
                                    : "border-border/60 bg-card/60 hover:border-zinc-400/60 hover:bg-accent/40 dark:hover:border-zinc-700"
                                } ${
                                  isBeingDragged ? "opacity-35 scale-[0.98]" : ""
                                } ${
                                  isHoveredOver && dragOverItem?.position === "before"
                                    ? "border-t-2 border-t-primary shadow-xs"
                                    : ""
                                } ${
                                  isHoveredOver && dragOverItem?.position === "after"
                                    ? "border-b-2 border-b-primary shadow-xs"
                                    : ""
                                }`}
                              >
                                <div className="flex items-start gap-1.5 min-w-0 flex-1 pr-1">
                                  <GripVertical className="size-3.5 mt-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold text-xs text-foreground">
                                      {title}
                                    </p>
                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                      {artist}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isSelected && (
                                    <Badge
                                      variant="default"
                                      className="h-4 px-1 text-[9px] font-medium"
                                    >
                                      Ativo
                                    </Badge>
                                  )}

                                  {/* Dropdown Menu for item (3 dots) */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      >
                                        <MoreVertical className="size-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="min-w-44 whitespace-nowrap text-xs"
                                    >
                                      <DropdownMenuItem
                                        onSelect={() => void useSongsStore.getState().editSong(item.songId)}
                                        className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                      >
                                        <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                                        <span>Editar música</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        disabled={itemIdx === 0}
                                        onSelect={() => moveItem(item.id, -1)}
                                        className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                      >
                                        <ArrowUp className="size-3.5 shrink-0" />
                                        <span>Mover para cima</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={itemIdx === part.items.length - 1}
                                        onSelect={() => moveItem(item.id, 1)}
                                        className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                      >
                                        <ArrowDown className="size-3.5 shrink-0" />
                                        <span>Mover para baixo</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onSelect={() => removeItem(item.id)}
                                        className="text-destructive focus:text-destructive whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 className="size-3.5 shrink-0" />
                                        <span>Remover da lista</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </ContextMenuTrigger>

                            {/* Context Menu for right-click on item */}
                            <ContextMenuContent className="min-w-44 whitespace-nowrap text-xs">
                              <ContextMenuItem
                                onClick={() => void useSongsStore.getState().editSong(item.songId)}
                                className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                              >
                                <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                                <span>Editar música</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                disabled={itemIdx === 0}
                                onClick={() => moveItem(item.id, -1)}
                                className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                              >
                                <ArrowUp className="size-3.5 shrink-0" />
                                <span>Mover para cima</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={itemIdx === part.items.length - 1}
                                onClick={() => moveItem(item.id, 1)}
                                className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                              >
                                <ArrowDown className="size-3.5 shrink-0" />
                                <span>Mover para baixo</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => removeItem(item.id)}
                                className="text-destructive focus:text-destructive whitespace-nowrap flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="size-3.5 shrink-0" />
                                <span>Remover da lista</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ContextMenuTrigger>

        {/* Background Context Menu for empty area */}
        <ContextMenuContent className="min-w-44 whitespace-nowrap text-xs">
          <ContextMenuItem
            onClick={() => handleAddMusic()}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Music className="size-3.5 text-primary" />
            <span>Adicionar Música</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setNewPartDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="size-3.5 text-primary" />
            <span>Adicionar Seção</span>
          </ContextMenuItem>
          {dirty && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => void save()}
                className="flex items-center gap-2 font-medium text-primary cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Salvar Programação</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Footer Info */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-3 text-[11px] text-muted-foreground">
        <span>{event ? `${event.parts.reduce((acc, p) => acc + p.items.length, 0)} itens` : "Sem evento"}</span>
        {dirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs font-semibold text-primary"
            onClick={() => void save()}
          >
            Salvar
          </Button>
        )}
      </div>

      {/* Dialog for Song Picker */}
      {pickerPartId && (
        <SongPickerDialog
          partId={pickerPartId}
          open={Boolean(pickerPartId)}
          onOpenChange={(open) => {
            if (!open) setPickerPartId(null);
          }}
        />
      )}

      {/* Dialog for New Part */}
      <Dialog open={newPartDialogOpen} onOpenChange={setNewPartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Seção da Programação</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <input
              type="text"
              value={newPartTitle}
              onChange={(e) => setNewPartTitle(e.target.value)}
              placeholder="Ex: Grupo de Louvor, Palavra, Ofertório..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePart();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewPartDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleCreatePart}>
              Criar Seção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for New Event */}
      <Dialog open={newEventDialogOpen} onOpenChange={setNewEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Culto / Evento</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <input
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Ex: Culto de Celebração - Domingo Noite"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateEvent();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewEventDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleCreateEvent}>
              Criar Culto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
