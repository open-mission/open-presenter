import { useRef, useState } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Image as ImageIcon,
  Images,
  MoreVertical,
  Music,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mediaKindLabel } from "@/core/lib/media";
import { openMediaLibrary, openThemeEditor } from "@/core/ipc/commands";
import type { EventItem, EventPart, MediaKind } from "@/core/types";
import { useSongsStore } from "@/features/songs/store";
import { createEmptyStudioTheme } from "@/features/slide-themes/seedThemes";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { findEventItem, useSetlistStore } from "./store";
import { MediaDialog, type VisualMediaKind } from "./MediaDialog";
import { TextEditorDialog } from "./TextEditorDialog";
import { EventDetailsDialog } from "./EventDetailsDialog";
import { SongPickerDialog } from "./SongPickerDialog";
import { StudioPickerDialog } from "./StudioPickerDialog";
import { BibleVersePickerDialog } from "./BibleVersePickerDialog";
import { formatEventDateTime } from "./dateUtils";

const MEDIA_ICONS: Record<MediaKind, typeof AlignLeft> = {
  text: AlignLeft,
  image: ImageIcon,
  folder: Images,
  video: Video,
};

const MEDIA_KIND_OPTIONS: Array<{
  kind: VisualMediaKind;
  label: string;
  icon: typeof ImageIcon;
}> = [
  { kind: "image", label: "Imagem", icon: ImageIcon },
  { kind: "folder", label: "Pasta de imagens", icon: Images },
  { kind: "video", label: "Vídeo", icon: Video },
];

function ItemKindIcon({ item }: { item: EventItem }) {
  if (item.scripture) {
    return <BookOpen className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />;
  }
  const media = item.media;
  if (media?.themeId) {
    return <Sparkles className="size-3.5 mt-0.5 shrink-0 text-amber-500" />;
  }
  const Icon = media ? MEDIA_ICONS[media.kind] : Music;
  return (
    <Icon
      className={`size-3.5 mt-0.5 shrink-0 ${
        media ? "text-sky-500" : "text-primary"
      }`}
    />
  );
}

function scriptureTitle(item: EventItem): string | null {
  if (!item.scripture) return null;
  return `${item.scripture.bookName} ${item.scripture.chapter}:${item.scripture.verse}`;
}

function itemTitle(item: EventItem): string {
  if (item.media?.themeId) {
    const studioTheme = useSlideThemesStore
      .getState()
      .themes.find((t) => t.guid === item.media?.themeId);
    if (studioTheme?.title) return studioTheme.title;
  }
  return (
    scriptureTitle(item) ||
    item.media?.title ||
    item.song?.title ||
    (item.media ? "Mídia sem título" : "Música sem título")
  );
}

function itemSubtitle(item: EventItem): string {
  if (item.scripture) {
    return `Bíblia · ${item.scripture.versionId}`;
  }
  if (item.media?.themeId) {
    return "Apresentação (Studio)";
  }
  if (item.media) {
    const count = item.media.files?.length ?? 0;
    return item.media.kind === "folder"
      ? `${mediaKindLabel(item.media.kind)} · ${count} ${count === 1 ? "imagem" : "imagens"}`
      : mediaKindLabel(item.media.kind);
  }
  return item.song?.artist || "Louvor";
}

const LABEL_COLOR_PRESETS = [
  { label: "Padrão", value: "" },
  { label: "Branco", value: "#ffffff" },
  { label: "Cinza", value: "#9ca3af" },
  { label: "Amarelo", value: "#eab308" },
  { label: "Laranja", value: "#f97316" },
  { label: "Vermelho", value: "#ef4444" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Roxo", value: "#a855f7" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Ciano", value: "#06b6d4" },
  { label: "Esmeralda", value: "#10b981" },
];

const BG_COLOR_PRESETS = [
  { label: "Transparente", value: "" },
  { label: "Cinza Escuro", value: "#27272a" },
  { label: "Grafite", value: "#1e293b" },
  { label: "Azul Marinho", value: "#1e3a8a" },
  { label: "Vinho", value: "#7f1d1d" },
  { label: "Verde Escuro", value: "#14532d" },
  { label: "Roxo Escuro", value: "#581c87" },
  { label: "Âmbar Escuro", value: "#78350f" },
  { label: "Petróleo", value: "#134e4a" },
  { label: "Índigo", value: "#312e81" },
];

export function SetlistSidebar({
  collapsed = false,
  onToggleSidebar,
}: {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const events = useSetlistStore((s) => s.events);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const event = useSetlistStore((s) => s.event);
  const selectedItemId = useSetlistStore((s) => s.selectedItemId);
  const selectItem = useSetlistStore((s) => s.selectItem);
  const selectEvent = useSetlistStore((s) => s.selectEvent);
  const createEvent = useSetlistStore((s) => s.createEvent);
  const deleteEvent = useSetlistStore((s) => s.deleteEvent);
  const addPart = useSetlistStore((s) => s.addPart);
  const renamePart = useSetlistStore((s) => s.renamePart);
  const updatePartStyle = useSetlistStore((s) => s.updatePartStyle);
  const removePart = useSetlistStore((s) => s.removePart);
  const movePart = useSetlistStore((s) => s.movePart);
  const reorderParts = useSetlistStore((s) => s.reorderParts);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const moveItem = useSetlistStore((s) => s.moveItem);
  const reorderItem = useSetlistStore((s) => s.reorderItem);
  const save = useSetlistStore((s) => s.save);
  const dirty = useSetlistStore((s) => s.dirty);
  const addMedia = useSetlistStore((s) => s.addMedia);
  const listMode = useSetlistStore((s) => s.listMode);
  const switchListMode = useSetlistStore((s) => s.switchListMode);
  const clearTemporary = useSetlistStore((s) => s.clearTemporary);
  const moveItemToOtherList = useSetlistStore((s) => s.moveItemToOtherList);

  async function handleMoveItem(itemId: string) {
    const item = findEventItem(event, itemId);
    const title = item ? itemTitle(item) : "Item";
    await moveItemToOtherList(itemId);
    if (listMode === "event") {
      toast.success(`"${title}" movido para a Lista Temporária.`);
    } else {
      toast.success(`"${title}" movido para a Programação do Culto.`);
    }
  }

  async function handleClearTemporary() {
    await clearTemporary();
    toast.success("Lista temporária limpa.");
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [pickerPartId, setPickerPartId] = useState<string | null>(null);
  const [studioPickerPartId, setStudioPickerPartId] = useState<string | null>(null);
  const [biblePickerPartId, setBiblePickerPartId] = useState<string | null>(null);
  const [newPartDialogOpen, setNewPartDialogOpen] = useState(false);
  const [newPartTitle, setNewPartTitle] = useState("");
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaPartId, setMediaPartId] = useState<string | null>(null);
  const [mediaItemId, setMediaItemId] = useState<string | null>(null);
  const [mediaInitialKind, setMediaInitialKind] =
    useState<VisualMediaKind>("image");
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textEditorPartId, setTextEditorPartId] = useState("");
  const [textEditorItemId, setTextEditorItemId] = useState<string | null>(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);

  // Collapse, color and rename section states
  const [collapsedParts, setCollapsedParts] = useState<Record<string, boolean>>({});
  const [colorDialogPart, setColorDialogPart] = useState<EventPart | null>(null);
  const [selectedLabelColor, setSelectedLabelColor] = useState("");
  const [selectedBgColor, setSelectedBgColor] = useState("");
  const [renameDialogPart, setRenameDialogPart] = useState<EventPart | null>(null);
  const [renamePartTitle, setRenamePartTitle] = useState("");

  function toggleCollapse(partId: string) {
    setCollapsedParts((prev) => ({
      ...prev,
      [partId]: !prev[partId],
    }));
  }

  function openColorDialog(part: EventPart) {
    setColorDialogPart(part);
    setSelectedLabelColor(part.color || "");
    setSelectedBgColor(part.bgColor || "");
  }

  function handleSaveColors() {
    if (!colorDialogPart) return;
    updatePartStyle(colorDialogPart.id, {
      color: selectedLabelColor.trim() || null,
      bgColor: selectedBgColor.trim() || null,
    });
    setColorDialogPart(null);
    void save();
  }

  function handleClearColors() {
    setSelectedLabelColor("");
    setSelectedBgColor("");
  }

  function openRenameDialog(part: EventPart) {
    setRenameDialogPart(part);
    setRenamePartTitle(part.title);
  }

  function handleSaveRename() {
    if (!renameDialogPart || !renamePartTitle.trim()) return;
    renamePart(renameDialogPart.id, renamePartTitle.trim());
    setRenameDialogPart(null);
    void save();
  }

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
      const newPartId = addPart("");
      setPickerPartId(newPartId);
      void save();
    } else {
      const untitled = event.parts.find((p) => p.title.trim() === "");
      setPickerPartId(untitled ? untitled.id : event.parts[0].id);
    }
  }

  function handleOpenStudioPicker(targetPartId?: string) {
    if (!event) return;
    if (targetPartId) {
      setStudioPickerPartId(targetPartId);
      return;
    }
    if (event.parts.length === 0) {
      const newPartId = addPart("");
      setStudioPickerPartId(newPartId);
      void save();
    } else {
      const untitled = event.parts.find((p) => p.title.trim() === "");
      setStudioPickerPartId(untitled ? untitled.id : event.parts[0].id);
    }
  }

  function handleAddScripture(targetPartId?: string) {
    if (!event) return;
    const partId = resolvePartId(targetPartId);
    if (!partId) {
      const newPartId = addPart("");
      setBiblePickerPartId(newPartId);
      void save();
      return;
    }
    setBiblePickerPartId(partId);
  }

  function resolvePartId(targetPartId?: string): string {
    if (targetPartId) return targetPartId;
    if (!event || event.parts.length === 0) return "";
    const untitled = event.parts.find((p) => p.title.trim() === "");
    return untitled ? untitled.id : event.parts[0].id;
  }

  function handleAddMedia(targetPartId?: string, kind: MediaKind = "text") {
    if (!event) return;
    const partId = resolvePartId(targetPartId);

    if (kind === "text") {
      setTextEditorPartId(partId);
      setTextEditorItemId(null);
      setTextEditorOpen(true);
      return;
    }

    setMediaPartId(partId);
    setMediaItemId(null);
    setMediaInitialKind(kind);
    setMediaDialogOpen(true);
  }

  async function handleAddPresentation(targetPartId?: string) {
    if (!event) return;
    const partId = resolvePartId(targetPartId);
    if (!partId) return;

    try {
      const theme = createEmptyStudioTheme("Aviso / Comunicado");
      await useSlideThemesStore.getState().save(theme);
      const newMediaItemId = addMedia(partId, {
        kind: "text",
        title: theme.title,
        text: "",
        themeId: theme.guid,
      });
      selectItem(newMediaItemId);
      await save();
      toast.success("Apresentação criada no Studio!");
      await openThemeEditor(theme.guid);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao criar apresentação no Studio.",
      );
    }
  }

  function handleEditMedia(itemId: string) {
    if (!event) return;
    const item = findEventItem(event, itemId);
    const part = event.parts.find((candidate) =>
      candidate.items.some((candidateItem) => candidateItem.id === itemId),
    );
    if (!part) return;

    if (item?.media?.themeId) {
      void openThemeEditor(item.media.themeId);
      return;
    }

    if (item?.media?.kind === "text") {
      setTextEditorPartId(part.id);
      setTextEditorItemId(itemId);
      setTextEditorOpen(true);
      return;
    }

    setMediaPartId(part.id);
    setMediaItemId(itemId);
    setMediaDialogOpen(true);
  }

  async function handleOpenMediaLibrary() {
    try {
      await openMediaLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }


  const totalItems = event?.parts.reduce((acc, p) => acc + p.items.length, 0) ?? 0;

  if (collapsed) {
    return (
      <aside className="flex h-full w-10 shrink-0 flex-col items-center border-r border-border bg-muted/20 py-2 select-none">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onToggleSidebar}
          title="Mostrar Programação"
        >
          <PanelLeftOpen className="size-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 min-h-0 flex-col border-r border-border bg-muted/20 sm:w-80 shrink-0 select-none overflow-hidden">
      {/* List Mode Switcher: Culto / Evento | Temporário */}
      <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-background/50 p-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 rounded-lg bg-muted/60 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => void switchListMode("event")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
              listMode === "event"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="size-3.5 text-primary" />
            <span className="truncate">Culto / Evento</span>
          </button>
          <button
            type="button"
            onClick={() => void switchListMode("temporary")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
              listMode === "temporary"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="truncate">Temporário</span>
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onToggleSidebar}
          title="Ocultar Programação"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      {/* Top Header: Event Title & Action Plus */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
        {listMode === "temporary" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex flex-col text-left transition-colors outline-none cursor-pointer max-w-[170px] sm:max-w-[195px]"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">
                  <span className="truncate">Lista Temporária</span>
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-500 bg-amber-500/10 font-normal">
                    Avulsa
                  </Badge>
                  <span className="text-[11px] text-muted-foreground truncate">
                    Sem vínculo a culto
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem
                onSelect={() => void handleClearTemporary()}
                className="text-xs text-destructive focus:text-destructive cursor-pointer py-1.5"
              >
                <Trash2 className="size-3.5 mr-2" />
                <span>Limpar lista temporária</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex flex-col text-left transition-colors outline-none cursor-pointer max-w-[170px] sm:max-w-[195px]"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">
                  <span className="truncate">
                    {event?.title || "Programação do Culto"}
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>
                {event?.eventDate && (
                  <span className="text-[11px] font-medium text-muted-foreground truncate">
                    {formatEventDateTime(event.eventDate).displaySummary}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 sm:w-80 max-h-[65vh] overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cultos & Eventos
            </div>
            {events.map((ev) => {
              const dt = formatEventDateTime(ev.eventDate);
              const isSelected = ev.id === activeEventId;
              return (
                <DropdownMenuItem
                  key={ev.id}
                  onSelect={() => void selectEvent(ev.id)}
                  className={`flex items-center justify-between py-2 px-2.5 text-xs cursor-pointer ${
                    isSelected ? "bg-accent/60 font-semibold" : ""
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-semibold text-foreground truncate">{ev.title}</span>
                    {dt.displaySummary && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {dt.displaySummary}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="size-4 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => useSetlistStore.getState().openAgenda()}
              className="text-xs cursor-pointer py-1.5"
            >
              <Calendar className="size-3.5 mr-2 text-primary" />
              <span>Abrir Agenda de Eventos…</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => useSetlistStore.getState().openNewEventDialog(undefined, true)}
              className="text-xs cursor-pointer py-1.5"
            >
              <Plus className="size-3.5 mr-2 text-primary" />
              <span>Novo Culto / Evento…</span>
            </DropdownMenuItem>
            {event && (
              <DropdownMenuItem
                onSelect={() => setEventDetailsOpen(true)}
                className="text-xs cursor-pointer py-1.5"
              >
                <ImageIcon className="size-3.5 mr-2 text-primary" />
                <span>Plano de Fundo do Culto…</span>
              </DropdownMenuItem>
            )}
            {event && (
              <DropdownMenuItem
                onSelect={() => void deleteEvent(event.id)}
                className="text-xs text-destructive focus:text-destructive cursor-pointer py-1.5"
              >
                <Trash2 className="size-3.5 mr-2" />
                <span>Excluir este evento</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        )}

        {/* Action Buttons: Calendar Quick Access & Plus Menu */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-lg border-border/80 shadow-2xs hover:bg-accent hover:text-primary transition-colors cursor-pointer"
            onClick={() => useSetlistStore.getState().openAgenda()}
            title="Agenda & Cronograma de Eventos"
            aria-label="Abrir agenda de eventos"
          >
            <Calendar className="size-4 text-foreground" />
          </Button>

          {/* Plus Action Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-lg border-border/80 shadow-2xs hover:bg-accent cursor-pointer"
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs cursor-pointer font-medium">
                  <Sparkles className="size-3.5 mr-2 text-amber-500" />
                  Apresentação (Studio)
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuItem
                    onSelect={() => handleOpenStudioPicker()}
                    className="text-xs cursor-pointer font-medium"
                  >
                    <Search className="size-3.5 mr-2 text-amber-500" />
                    Inserir Salva da Biblioteca...
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void handleAddPresentation()}
                    className="text-xs cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-2 text-primary" />
                    Criar Nova no Studio...
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onSelect={() => handleAddMedia(undefined, "text")}
                className="text-xs cursor-pointer"
              >
                <AlignLeft className="size-3.5 mr-2 text-sky-500" />
                Adicionar Texto
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleAddScripture()}
                className="text-xs cursor-pointer"
              >
                <BookOpen className="size-3.5 mr-2 text-emerald-500" />
                Adicionar Versículo
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setNewPartDialogOpen(true)}
                className="text-xs cursor-pointer"
              >
                <FolderPlus className="size-3.5 mr-2 text-primary" />
                Adicionar Seção
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                  <ImageIcon className="size-3.5 mr-2 text-sky-500" />
                  Adicionar Mídia
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {MEDIA_KIND_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <DropdownMenuItem
                        key={option.kind}
                        onSelect={() => handleAddMedia(undefined, option.kind)}
                        className="text-xs cursor-pointer"
                      >
                        <Icon className="size-3.5 mr-2 text-sky-500" />
                        {option.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onSelect={() => void handleOpenMediaLibrary()}
                className="text-xs cursor-pointer"
              >
                <FolderOpen className="size-3.5 mr-2 text-muted-foreground" />
                Abrir Pasta de Mídias
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
      </div>

      {/* Search Input Bar */}
      <div className="border-b border-border/60 p-3 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar na programação…"
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
                  <p className="text-[11px] text-muted-foreground max-w-[220px] leading-relaxed">
                    Adicione músicas, textos, mídias ou seções para montar a programação deste culto.
                  </p>
                </div>
                <div className="grid w-full max-w-[240px] grid-cols-2 gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs font-medium w-full cursor-pointer"
                    onClick={() => handleAddMusic()}
                  >
                    <Music className="size-3.5 mr-1.5" />
                    Música
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium w-full cursor-pointer text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    onClick={() => handleOpenStudioPicker()}
                  >
                    <Sparkles className="size-3.5 mr-1.5 text-amber-500" />
                    Studio
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium w-full cursor-pointer"
                    onClick={() => handleAddMedia(undefined, "text")}
                  >
                    <AlignLeft className="size-3.5 mr-1.5" />
                    Texto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium w-full cursor-pointer"
                    onClick={() => handleAddMedia(undefined, "image")}
                  >
                    <ImageIcon className="size-3.5 mr-1.5" />
                    Mídia
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="col-span-2 h-8 text-xs font-medium w-full cursor-pointer"
                    onClick={() => setNewPartDialogOpen(true)}
                  >
                    <FolderPlus className="size-3.5 mr-1.5" />
                    Nova Seção
                  </Button>
                </div>
              </div>
            ) : (
              event.parts.map((part, partIdx) => {
                const filteredItems = part.items.filter((item) => {
                  if (!needle) return true;
                  const title = item.song?.title?.toLowerCase() || "";
                  const artist = item.song?.artist?.toLowerCase() || "";
                  const mediaTitle = item.media?.title.toLowerCase() || "";
                  const mediaKind = item.media
                    ? mediaKindLabel(item.media.kind).toLowerCase()
                    : "";
                  const scripture = item.scripture
                    ? `${item.scripture.bookName} ${item.scripture.chapter}:${item.scripture.verse} ${item.scripture.versionId}`.toLowerCase()
                    : "";
                  return (
                    title.includes(needle) ||
                    artist.includes(needle) ||
                    mediaTitle.includes(needle) ||
                    mediaKind.includes(needle) ||
                    scripture.includes(needle)
                  );
                });

                if (needle && filteredItems.length === 0) return null;

                const isUntitled = part.title.trim() === "";
                if (isUntitled && part.items.length === 0) return null;

                const isCollapsed = !isUntitled && Boolean(collapsedParts[part.id]);

                return (
                  <div
                    key={part.id}
                    className="space-y-1.5 rounded-lg transition-all"
                  >
                    {/* Part Section Header (only for named sections) */}
                    {!isUntitled && (
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
                        style={{
                          color: part.color || undefined,
                          backgroundColor: part.bgColor || undefined,
                        }}
                        className={`group flex cursor-grab active:cursor-grabbing items-center justify-between text-[11px] font-semibold tracking-wider transition-colors select-none ${
                          part.bgColor
                            ? "rounded-md border border-white/15 px-2.5 py-1.5 shadow-2xs"
                            : "rounded px-2 pt-1 pb-0.5 text-muted-foreground hover:bg-muted/40"
                        } ${
                          draggedPartIndex === partIdx ? "opacity-35" : ""
                        } ${
                          dragOverPartIndex === partIdx ? "bg-primary/10 ring-2 ring-primary/40 rounded" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-1.5">
                          <GripVertical className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(part.id);
                            }}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                            title={isCollapsed ? "Expandir seção" : "Colapsar seção"}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>
                          <span
                            className="truncate cursor-pointer hover:underline uppercase"
                            onClick={() => toggleCollapse(part.id)}
                          >
                            {part.title}
                          </span>
                          {isCollapsed && (
                            <span className="text-[10px] font-normal opacity-70 shrink-0 lowercase">
                              ({filteredItems.length} {filteredItems.length === 1 ? "item" : "itens"})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Adicionar item nesta seção"
                              >
                                <Plus className="size-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onSelect={() => setPickerPartId(part.id)}
                                className="text-xs cursor-pointer"
                              >
                                <Music className="size-3.5 mr-2 text-primary" />
                                Adicionar Música
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs cursor-pointer font-medium">
                                  <Sparkles className="size-3.5 mr-2 text-amber-500" />
                                  Apresentação (Studio)
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-56">
                                  <DropdownMenuItem
                                    onSelect={() => handleOpenStudioPicker(part.id)}
                                    className="text-xs cursor-pointer font-medium"
                                  >
                                    <Search className="size-3.5 mr-2 text-amber-500" />
                                    Inserir Salva da Biblioteca...
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => void handleAddPresentation(part.id)}
                                    className="text-xs cursor-pointer"
                                  >
                                    <Plus className="size-3.5 mr-2 text-primary" />
                                    Criar Nova no Studio...
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem
                                onSelect={() => handleAddMedia(part.id, "text")}
                                className="text-xs cursor-pointer"
                              >
                                <AlignLeft className="size-3.5 mr-2 text-sky-500" />
                                Adicionar Texto
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => handleAddScripture(part.id)}
                                className="text-xs cursor-pointer"
                              >
                                <BookOpen className="size-3.5 mr-2 text-emerald-500" />
                                Adicionar Versículo
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                                  <ImageIcon className="size-3.5 mr-2 text-sky-500" />
                                  Adicionar Mídia
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-52">
                                  {MEDIA_KIND_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                      <DropdownMenuItem
                                        key={option.kind}
                                        onSelect={() => handleAddMedia(part.id, option.kind)}
                                        className="text-xs cursor-pointer"
                                      >
                                        <Icon className="size-3.5 mr-2 text-sky-500" />
                                        {option.label}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <button
                            type="button"
                            onClick={() => openColorDialog(part)}
                            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Personalizar cores (Label / Fundo)"
                          >
                            <Palette className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openRenameDialog(part)}
                            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Renomear seção"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            disabled={partIdx === 0}
                            onClick={() => movePart(part.id, -1)}
                            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                            title="Mover seção para cima"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            disabled={partIdx === event.parts.length - 1}
                            onClick={() => movePart(part.id, 1)}
                            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                            title="Mover seção para baixo"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePart(part.id)}
                            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 text-destructive hover:text-destructive cursor-pointer"
                            title="Excluir seção"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Empty section drop target */}
                    {!isCollapsed && !isUntitled && part.items.length === 0 && (
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

                    {/* Items in Part (only when expanded) */}
                    {!isCollapsed && (
                      <div className="space-y-1">
                      {filteredItems.map((item, itemIdx) => {
                        const isSelected = selectedItemId === item.id;
                        const title = itemTitle(item);
                        const artist = itemSubtitle(item);
                        const isMedia = item.media != null;
                        const isScripture = item.scripture != null;
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
                                  <ItemKindIcon item={item} />
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
                                      {isMedia ? (
                                        <DropdownMenuItem
                                          onSelect={() => handleEditMedia(item.id)}
                                          className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                        >
                                          {item.media?.themeId ? (
                                            <>
                                              <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                                              <span>Editar no Studio</span>
                                            </>
                                          ) : (
                                            <>
                                              <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                                              <span>Editar mídia</span>
                                            </>
                                          )}
                                        </DropdownMenuItem>
                                      ) : isScripture ? null : (
                                        <DropdownMenuItem
                                          onSelect={() => {
                                            if (item.songId) {
                                              void useSongsStore.getState().editSong(item.songId);
                                            }
                                          }}
                                          className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                        >
                                          <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                                          <span>Editar música</span>
                                        </DropdownMenuItem>
                                      )}
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
                                        onSelect={() => void handleMoveItem(item.id)}
                                        className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                      >
                                        {listMode === "event" ? (
                                          <>
                                            <RotateCcw className="size-3.5 shrink-0 text-amber-500" />
                                            <span>Mover para Temporário</span>
                                          </>
                                        ) : (
                                          <>
                                            <Calendar className="size-3.5 shrink-0 text-primary" />
                                            <span>Mover para Culto</span>
                                          </>
                                        )}
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
                              {isMedia ? (
                                <ContextMenuItem
                                  onClick={() => handleEditMedia(item.id)}
                                  className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                >
                                  {item.media?.themeId ? (
                                    <>
                                      <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                                      <span>Editar no Studio</span>
                                    </>
                                  ) : (
                                    <>
                                      <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                                      <span>Editar mídia</span>
                                    </>
                                  )}
                                </ContextMenuItem>
                              ) : isScripture ? null : (
                                <ContextMenuItem
                                  onClick={() => {
                                    if (item.songId) {
                                      void useSongsStore.getState().editSong(item.songId);
                                    }
                                  }}
                                  className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                                >
                                  <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span>Editar música</span>
                                </ContextMenuItem>
                              )}
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
                                onClick={() => void handleMoveItem(item.id)}
                                className="whitespace-nowrap flex items-center gap-2 cursor-pointer"
                              >
                                {listMode === "event" ? (
                                  <>
                                    <RotateCcw className="size-3.5 shrink-0 text-amber-500" />
                                    <span>Mover para Temporário</span>
                                  </>
                                ) : (
                                  <>
                                    <Calendar className="size-3.5 shrink-0 text-primary" />
                                    <span>Mover para Culto</span>
                                  </>
                                )}
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
                  )}
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
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer font-medium">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Apresentação (Studio)</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56 text-xs">
              <ContextMenuItem
                onClick={() => handleOpenStudioPicker()}
                className="flex items-center gap-2 cursor-pointer font-medium"
              >
                <Search className="size-3.5 text-amber-500" />
                <span>Inserir Salva da Biblioteca...</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => void handleAddPresentation()}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Plus className="size-3.5 text-primary" />
                <span>Criar Nova no Studio...</span>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onClick={() => handleAddMedia(undefined, "text")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <AlignLeft className="size-3.5 text-sky-500" />
            <span>Adicionar Texto</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleAddScripture()}
            className="flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="size-3.5 text-emerald-500" />
            <span>Adicionar Versículo</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setNewPartDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="size-3.5 text-primary" />
            <span>Adicionar Seção</span>
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
              <ImageIcon className="size-3.5 text-sky-500" />
              <span>Adicionar Mídia</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52">
              {MEDIA_KIND_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <ContextMenuItem
                    key={option.kind}
                    onClick={() => handleAddMedia(undefined, option.kind)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="size-3.5 text-sky-500" />
                    <span>{option.label}</span>
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onClick={() => void handleOpenMediaLibrary()}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FolderOpen className="size-3.5 text-muted-foreground" />
            <span>Abrir Pasta de Mídias</span>
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
        <span>
          {listMode === "temporary"
            ? `Temporário · ${event ? event.parts.reduce((acc, p) => acc + p.items.length, 0) : 0} itens`
            : event
              ? `${event.parts.reduce((acc, p) => acc + p.items.length, 0)} itens`
              : "Sem evento"}
        </span>
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

      {/* Dialog for Studio Presentation Picker */}
      {studioPickerPartId && (
        <StudioPickerDialog
          partId={studioPickerPartId}
          open={Boolean(studioPickerPartId)}
          onOpenChange={(open) => {
            if (!open) setStudioPickerPartId(null);
          }}
        />
      )}

      {/* Dialog for adding a Bible verse to the setlist */}
      {biblePickerPartId && (
        <BibleVersePickerDialog
          partId={biblePickerPartId}
          open
          onOpenChange={(open) => {
            if (!open) setBiblePickerPartId(null);
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

      {/* Dialog for Customizing Part Colors */}
      <Dialog
        open={Boolean(colorDialogPart)}
        onOpenChange={(open) => {
          if (!open) setColorDialogPart(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              <span>Personalizar Cores da Seção</span>
            </DialogTitle>
          </DialogHeader>

          {colorDialogPart && (
            <div className="space-y-4 py-2">
              {/* Live Preview */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Prévia do Cabeçalho</span>
                <div
                  className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-xs font-semibold tracking-wider transition-all shadow-2xs"
                  style={{
                    color: selectedLabelColor || undefined,
                    backgroundColor: selectedBgColor || "transparent",
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <ChevronDown className="size-3.5" />
                    <span className="truncate uppercase">{colorDialogPart.title}</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-70">3 músicas</span>
                </div>
              </div>

              {/* Text / Label Color */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Cor do Texto (Label)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedLabelColor || "#ffffff"}
                      onChange={(e) => setSelectedLabelColor(e.target.value)}
                      className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
                      title="Escolher cor personalizada"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {selectedLabelColor || "Padrão"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LABEL_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setSelectedLabelColor(preset.value)}
                      className={`h-6 rounded-md px-2 text-[10px] font-medium border transition-all cursor-pointer ${
                        selectedLabelColor === preset.value
                          ? "border-primary ring-1 ring-primary font-semibold"
                          : "border-border/60 hover:border-border hover:bg-muted/60"
                      }`}
                      style={{
                        color: preset.value || undefined,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Cor do Fundo</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedBgColor || "#1e293b"}
                      onChange={(e) => setSelectedBgColor(e.target.value)}
                      className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
                      title="Escolher cor personalizada"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {selectedBgColor || "Transparente"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BG_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setSelectedBgColor(preset.value)}
                      className={`h-6 rounded-md px-2 text-[10px] font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedBgColor === preset.value
                          ? "border-primary ring-1 ring-primary font-semibold"
                          : "border-border/60 hover:border-border hover:bg-muted/60"
                      }`}
                    >
                      {preset.value ? (
                        <span
                          className="size-2.5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: preset.value }}
                        />
                      ) : null}
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearColors}
              className="text-xs cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3 mr-1.5" />
              Restaurar Padrão
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColorDialogPart(null)}
              >
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSaveColors}>
                Salvar Cores
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Renaming Part */}
      <Dialog
        open={Boolean(renameDialogPart)}
        onOpenChange={(open) => {
          if (!open) setRenameDialogPart(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Seção</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <input
              type="text"
              value={renamePartTitle}
              onChange={(e) => setRenamePartTitle(e.target.value)}
              placeholder="Nome da seção..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenameDialogPart(null)}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveRename}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Adding/Editing Media Items */}
      {mediaPartId !== null && (
        <MediaDialog
          open={mediaDialogOpen}
          onOpenChange={(open) => {
            setMediaDialogOpen(open);
            if (!open) setMediaItemId(null);
          }}
          partId={mediaPartId}
          itemId={mediaItemId}
          initialKind={mediaInitialKind}
        />
      )}

      {/* Full editor for text sequences */}
      <TextEditorDialog
        open={textEditorOpen}
        onOpenChange={(open) => {
          setTextEditorOpen(open);
          if (!open) setTextEditorItemId(null);
        }}
        partId={textEditorPartId}
        itemId={textEditorItemId}
      />

      {/* Event details and wallpaper configuration */}
      {event && (
        <EventDetailsDialog
          eventSummary={event}
          open={eventDetailsOpen}
          onClose={() => setEventDetailsOpen(false)}
        />
      )}
    </aside>
  );
}
