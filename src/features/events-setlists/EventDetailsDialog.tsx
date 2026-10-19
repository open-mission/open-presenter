import { useEffect, useState, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  Edit3,
  FolderPlus,
  Image as ImageIcon,
  Music,
  Palette,
  Plus,
  Repeat,
  Trash2,
  Tv,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getEvent, saveEvent, saveThemeMedia } from "@/core/ipc/commands";
import { isCssColor, isCssGradient } from "@/core/lib/cssValue";
import { useMediaPort } from "@/core/config/mediaPort";
import { mediaKindLabel } from "@/core/lib/media";
import { parseMediaWithFit, resolveThemeMediaUrl } from "@/features/theme-editor/media";
import { useSetlistStore } from "./store";
import { formatEventDateTime } from "./dateUtils";
import { EditEventDialog } from "./EditEventDialog";
import { EventThemeSelect } from "./EventThemeSelect";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { SongPickerDialog } from "./SongPickerDialog";
import type { EventItem, EventPart, EventSummary, ServiceEvent, SongSummary } from "@/core/types";

interface EventDetailsDialogProps {
  eventSummary: EventSummary | null;
  open: boolean;
  onClose: () => void;
  onSelectAndSwitch?: () => void;
}

const WALLPAPER_PRESETS = [
  { label: "Padrão", value: "" },
  { label: "Gradiente Noite", value: "radial-gradient(circle at 50% 0%, #1e3a8a 0%, #020617 60%, #000000 100%)" },
  { label: "Gradiente Pôr do Sol", value: "radial-gradient(circle at 50% 120%, #7c2d12 0%, #1c0a00 55%, #000000 100%)" },
  { label: "Roxo & Índigo", value: "linear-gradient(135deg, #312e81 0%, #4c1d95 50%, #0f172a 100%)" },
  { label: "Preto Absoluto", value: "#000000" },
];

const SUGGESTED_MOMENTS = [
  "Momento de Louvor",
  "Abertura",
  "Ofertório",
  "Ceia do Senhor",
  "Ministração",
  "Encerramento",
];

export function EventDetailsDialog({
  eventSummary,
  open,
  onClose,
  onSelectAndSwitch,
}: EventDetailsDialogProps) {
  const events = useSetlistStore((s) => s.events);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const selectEvent = useSetlistStore((s) => s.selectEvent);
  const deleteEvent = useSetlistStore((s) => s.deleteEvent);
  const deleteRecurringSeries = useSetlistStore((s) => s.deleteRecurringSeries);
  const updateEventDetails = useSetlistStore((s) => s.updateEventDetails);
  const updateRecurringSeries = useSetlistStore((s) => s.updateRecurringSeries);

  const [fullEvent, setFullEvent] = useState<ServiceEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSeriesChoice, setDeleteSeriesChoice] = useState<"single" | "series">("single");
  const [wallpaperScope, setWallpaperScope] = useState<"single" | "series">("single");
  const [deleteLinkedTheme, setDeleteLinkedTheme] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9");
  const [uploadingWp, setUploadingWp] = useState(false);
  const mediaPort = useMediaPort();

  // Setlist manipulation state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPartId, setPickerPartId] = useState<string | null>(null);
  const [newPartDialogOpen, setNewPartDialogOpen] = useState(false);
  const [newPartTitle, setNewPartTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = eventSummary?.id === activeEventId;

  // Check if part of a recurring series
  const seriesEvents = events.filter((e) => eventSummary && e.title === eventSummary.title);
  const isSeries = seriesEvents.length > 1;

  // Load full event when opened
  useEffect(() => {
    if (open && eventSummary) {
      setDeleteLinkedTheme(false);
      setLoading(true);
      void getEvent(eventSummary.id)
        .then((ev) => {
          setFullEvent(ev);
        })
        .finally(() => setLoading(false));
    } else {
      setFullEvent(null);
      setDeleteLinkedTheme(false);
    }
  }, [open, eventSummary]);

  if (!eventSummary) return null;

  const dt = formatEventDateTime(fullEvent?.eventDate || eventSummary.eventDate);
  const currentWallpaper = fullEvent?.wallpaper || eventSummary.wallpaper || null;
  const linkedThemeGuid = fullEvent?.themeGuid ?? eventSummary.themeGuid ?? null;

  async function handleThemeChange(themeGuid: string | null) {
    if (!eventSummary) return;
    try {
      await updateEventDetails(eventSummary.id, { themeGuid });
      setFullEvent((prev) => (prev ? { ...prev, themeGuid } : prev));
      toast.success(
        themeGuid
          ? "Tema do evento atualizado!"
          : "Evento usando o tema das configurações.",
      );
    } catch {
      toast.error("Erro ao aplicar tema do evento.");
    }
  }

  async function handleSelectActive() {
    if (!eventSummary) return;
    await selectEvent(eventSummary.id);
    toast.success(`"${eventSummary.title}" selecionado para apresentação!`);
    onClose();
    onSelectAndSwitch?.();
  }

  async function handleDelete() {
    if (!eventSummary) return;
    const shouldDeleteTheme = deleteLinkedTheme;
    const linkedTheme = linkedThemeGuid;
    try {
      if (deleteSeriesChoice === "series" && isSeries) {
        await deleteRecurringSeries(eventSummary.title);
        toast.success(`Todos os ${seriesEvents.length} eventos da série foram excluídos.`);
      } else {
        await deleteEvent(eventSummary.id);
        toast.success(`Evento "${eventSummary.title}" excluído.`);
      }
      if (shouldDeleteTheme && linkedTheme) {
        await useSlideThemesStore.getState().remove(linkedTheme);
      }
      setDeleteConfirmOpen(false);
      onClose();
    } catch {
      toast.error("Erro ao excluir evento.");
    }
  }

  async function handleWallpaperFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !eventSummary) return;
    setUploadingWp(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeName = `event_wp_${Date.now()}.${ext}`;
      const saved = await saveThemeMedia("wallpapers", safeName, Array.from(bytes));
      const wpVal = `${saved}#fit=contain`;

      if (wallpaperScope === "series" && isSeries) {
        await updateRecurringSeries(eventSummary.title, { wallpaper: wpVal });
        toast.success(`Papel de parede aplicado a todos os ${seriesEvents.length} cultos da série!`);
      } else {
        await updateEventDetails(eventSummary.id, { wallpaper: wpVal });
        toast.success("Papel de parede definido para este culto individual!");
      }

      setFullEvent((prev) => (prev ? { ...prev, wallpaper: wpVal } : prev));
    } catch {
      // Fallback: FileReader data URL
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          const wpVal = `${reader.result}#fit=contain`;
          if (wallpaperScope === "series" && isSeries) {
            await updateRecurringSeries(eventSummary.title, { wallpaper: wpVal });
            toast.success(`Papel de parede aplicado a todos os ${seriesEvents.length} cultos da série!`);
          } else {
            await updateEventDetails(eventSummary.id, { wallpaper: wpVal });
            toast.success("Papel de parede definido para este culto individual!");
          }
          setFullEvent((prev) => (prev ? { ...prev, wallpaper: wpVal } : prev));
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingWp(false);
      e.target.value = "";
    }
  }

  async function handleApplyPresetWallpaper(presetVal: string) {
    if (!eventSummary) return;
    const wpVal = presetVal ? presetVal : null;
    try {
      if (wallpaperScope === "series" && isSeries) {
        await updateRecurringSeries(eventSummary.title, { wallpaper: wpVal });
        toast.success(wpVal ? "Plano de fundo aplicado à série!" : "Plano de fundo removido da série.");
      } else {
        await updateEventDetails(eventSummary.id, { wallpaper: wpVal });
        toast.success(wpVal ? "Plano de fundo definido para este culto!" : "Plano de fundo removido deste culto.");
      }
      setFullEvent((prev) => (prev ? { ...prev, wallpaper: wpVal } : prev));
    } catch {
      toast.error("Erro ao aplicar plano de fundo.");
    }
  }

  // --- Setlist items & moments manipulation handlers ---

  async function handleOpenPicker(targetPartId?: string) {
    if (!fullEvent) return;

    if (fullEvent.parts.length === 0) {
      // Create a default initial part first
      const initialPart: EventPart = {
        id: crypto.randomUUID(),
        title: "Momento de Louvor",
        items: [],
        color: null,
        bgColor: null,
      };
      const updated: ServiceEvent = {
        ...fullEvent,
        parts: [initialPart],
      };
      await saveEvent(updated);
      setFullEvent(updated);
      if (useSetlistStore.getState().event?.id === fullEvent.id) {
        useSetlistStore.setState({ event: updated });
      }
      setPickerPartId(initialPart.id);
    } else {
      const partId = targetPartId || fullEvent.parts[fullEvent.parts.length - 1].id;
      setPickerPartId(partId);
    }

    setPickerOpen(true);
  }

  async function handleAddSong(partId: string, song: SongSummary) {
    if (!fullEvent) return;
    const item: EventItem = {
      id: crypto.randomUUID(),
      songId: song.id,
      nextItemId: null,
      song,
      media: null,
    };

    let targetPartId = partId;
    let newParts = [...fullEvent.parts];

    if (newParts.length === 0) {
      const newPart: EventPart = {
        id: crypto.randomUUID(),
        title: "Momento de Louvor",
        items: [item],
        color: null,
        bgColor: null,
      };
      newParts = [newPart];
    } else {
      const exists = newParts.some((p) => p.id === targetPartId);
      if (!exists) {
        targetPartId = newParts[newParts.length - 1].id;
      }
      newParts = newParts.map((p) =>
        p.id === targetPartId ? { ...p, items: [...p.items, item] } : p,
      );
    }

    const updated: ServiceEvent = {
      ...fullEvent,
      parts: newParts,
    };

    try {
      await saveEvent(updated);
      setFullEvent(updated);
      if (useSetlistStore.getState().event?.id === fullEvent.id) {
        useSetlistStore.setState({ event: updated });
      }
      toast.success(`"${song.title}" adicionada ao setlist!`);
    } catch {
      toast.error("Erro ao salvar música no setlist.");
    }
  }

  async function handleCreatePart() {
    if (!fullEvent) return;
    const title = newPartTitle.trim() || "Momento de Louvor";
    const newPart: EventPart = {
      id: crypto.randomUUID(),
      title,
      items: [],
      color: null,
      bgColor: null,
    };
    const updated: ServiceEvent = {
      ...fullEvent,
      parts: [...fullEvent.parts, newPart],
    };

    try {
      await saveEvent(updated);
      setFullEvent(updated);
      if (useSetlistStore.getState().event?.id === fullEvent.id) {
        useSetlistStore.setState({ event: updated });
      }
      setNewPartTitle("");
      setNewPartDialogOpen(false);
      toast.success(`Momento "${title}" criado.`);
    } catch {
      toast.error("Erro ao criar momento no setlist.");
    }
  }

  async function handleRemoveSong(partId: string, itemId: string) {
    if (!fullEvent) return;
    const newParts = fullEvent.parts.map((p) =>
      p.id === partId
        ? { ...p, items: p.items.filter((item) => item.id !== itemId) }
        : p,
    );
    const updated: ServiceEvent = {
      ...fullEvent,
      parts: newParts,
    };
    try {
      await saveEvent(updated);
      setFullEvent(updated);
      if (useSetlistStore.getState().event?.id === fullEvent.id) {
        useSetlistStore.setState({ event: updated });
      }
      toast.success("Música removida do culto.");
    } catch {
      toast.error("Erro ao remover música.");
    }
  }

  async function handleRemovePart(partId: string) {
    if (!fullEvent) return;
    const newParts = fullEvent.parts.filter((p) => p.id !== partId);
    const updated: ServiceEvent = {
      ...fullEvent,
      parts: newParts,
    };
    try {
      await saveEvent(updated);
      setFullEvent(updated);
      if (useSetlistStore.getState().event?.id === fullEvent.id) {
        useSetlistStore.setState({ event: updated });
      }
      toast.success("Momento removido do setlist.");
    } catch {
      toast.error("Erro ao remover momento.");
    }
  }

  async function handleMoveSong(partId: string, itemIdx: number, dir: -1 | 1) {
    if (!fullEvent) return;
    const part = fullEvent.parts.find((p) => p.id === partId);
    if (!part) return;
    const targetIdx = itemIdx + dir;
    if (targetIdx < 0 || targetIdx >= part.items.length) return;

    const newItems = [...part.items];
    const [moved] = newItems.splice(itemIdx, 1);
    newItems.splice(targetIdx, 0, moved);

    const newParts = fullEvent.parts.map((p) =>
      p.id === partId ? { ...p, items: newItems } : p,
    );
    const updated: ServiceEvent = {
      ...fullEvent,
      parts: newParts,
    };
    try {
      await saveEvent(updated);
      setFullEvent(updated);
      if (useSetlistStore.getState().event?.id === fullEvent.id) {
        useSetlistStore.setState({ event: updated });
      }
    } catch {
      toast.error("Erro ao reordenar música.");
    }
  }

  // Count items
  const totalParts = fullEvent?.parts.length ?? 0;
  const totalSongs = fullEvent?.parts.reduce((acc, p) => acc + p.items.length, 0) ?? 0;

  return (
    <>
      <Dialog open={open && !editDialogOpen} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-4xl md:max-w-5xl lg:max-w-5xl w-[94vw] h-[86vh] max-h-[760px] flex flex-col p-0 gap-0 overflow-hidden"
        >
          {/* Header */}
          <DialogHeader className="px-6 py-3.5 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <DialogTitle className="text-lg font-bold truncate">
                  {fullEvent?.title || eventSummary.title}
                </DialogTitle>
                {isActive ? (
                  <Badge variant="default" className="gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-600 text-white font-semibold shrink-0">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    <span>Ativo na Projeção</span>
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px] shrink-0">
                    Programado
                  </Badge>
                )}
                {isSeries && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
                    <Repeat className="size-3 mr-1" />
                    <span>Série ({seriesEvents.length} cultos)</span>
                  </Badge>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs shrink-0 cursor-pointer"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit3 className="size-3.5" />
                <span>Editar Evento</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Main Body: 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Coluna 1: Info do Evento e Planos de Fundo */}
            <ScrollArea className="h-full overflow-y-auto">
              <div className="p-5 flex flex-col gap-4">
                {/* Informações de Data e Horário */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Calendar className="size-4 text-primary shrink-0" />
                    <span>Data e Horário</span>
                  </div>
                  <div className="flex flex-col gap-1 pl-6">
                    <span className="text-sm font-semibold text-foreground">
                      {dt.weekdayFull ? `${dt.weekdayFull}, ` : ""}{dt.formattedDate || eventSummary.eventDate}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" />
                      <span>
                        {dt.timeRange ? dt.timeRange : "Horário livre / dia inteiro"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Palette className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Tema do Evento</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Define a identidade visual da projeção enquanto este culto está selecionado.
                      </p>
                    </div>
                  </div>
                  <EventThemeSelect
                    value={fullEvent?.themeGuid ?? eventSummary.themeGuid ?? null}
                    onChange={(guid) => void handleThemeChange(guid)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Contextos sem página neste tema usam o vínculo das configurações.
                  </p>
                </div>

                {/* Seção Plano de Fundo / Papel de Parede do Culto */}
                <div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <ImageIcon className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Plano de Fundo do Culto
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Exibido no telão durante a projeção deste culto.
                        </p>
                      </div>
                    </div>

                    {currentWallpaper && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => void handleApplyPresetWallpaper("")}
                      >
                        <X className="size-3.5 mr-1" />
                        <span>Remover</span>
                      </Button>
                    )}
                  </div>

                  {/* Escopo se for série recorrente */}
                  {isSeries && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50 text-[11px]">
                      <span className="text-muted-foreground">Aplicar a:</span>
                      <button
                        type="button"
                        onClick={() => setWallpaperScope("single")}
                        className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer transition-all ${
                          wallpaperScope === "single"
                            ? "bg-secondary text-primary font-bold border-primary"
                            : "text-muted-foreground border-border/60 hover:bg-secondary/40"
                        }`}
                      >
                        Apenas este culto
                      </button>
                      <button
                        type="button"
                        onClick={() => setWallpaperScope("series")}
                        className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer transition-all ${
                          wallpaperScope === "series"
                            ? "bg-secondary text-primary font-bold border-primary"
                            : "text-muted-foreground border-border/60 hover:bg-secondary/40"
                        }`}
                      >
                        Toda a série ({seriesEvents.length})
                      </button>
                    </div>
                  )}

                  {/* Seletor de Proporção (16:9 ou 4:3) */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Proporção do Telão:
                    </span>
                    <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
                      <button
                        type="button"
                        onClick={() => setAspectRatio("16:9")}
                        className={`px-2.5 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
                          aspectRatio === "16:9"
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        16:9 Widescreen
                      </button>
                      <button
                        type="button"
                        onClick={() => setAspectRatio("4:3")}
                        className={`px-2.5 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
                          aspectRatio === "4:3"
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        4:3 Tradicional
                      </button>
                    </div>
                  </div>

                  {/* Preview do Plano de Fundo com proporção selecionada e imagem completa */}
                  <div
                    className={`w-full ${
                      aspectRatio === "16:9" ? "aspect-video" : "aspect-[4/3]"
                    } max-h-[220px] mx-auto rounded-lg border border-border bg-zinc-950 relative overflow-hidden flex items-center justify-center transition-all duration-200 shadow-inner`}
                  >
                    {currentWallpaper ? (
                      (() => {
                        const { url } = parseMediaWithFit(currentWallpaper);
                        const isColor = isCssColor(url);
                        const isGradient = isCssGradient(url);
                        const resolved = resolveThemeMediaUrl(
                          url,
                          undefined,
                          mediaPort ?? undefined,
                        );

                        if (isColor || isGradient) {
                          return <div className="h-full w-full" style={{ background: url }} />;
                        }
                        const isVideo =
                          url.endsWith(".mp4") ||
                          url.endsWith(".webm") ||
                          url.startsWith("data:video");
                        if (isVideo) {
                          return (
                            <video
                              src={resolved}
                              className="h-full w-full object-contain"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          );
                        }
                        return (
                          <img
                            src={resolved}
                            alt="Papel de Parede"
                            className="h-full w-full object-contain"
                          />
                        );
                      })()
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-center p-3">
                        <ImageIcon className="size-7 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground font-medium">
                          Nenhum plano de fundo configurado
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 max-w-[220px]">
                          O telão exibirá o papel de parede padrão global das preferências
                        </span>
                      </div>
                    )}

                    {/* Botão de Troca / Upload */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleWallpaperFile}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs gap-1.5 shadow-md bg-background/95 backdrop-blur-xs border border-border/70 hover:bg-background cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingWp}
                      >
                        <Upload className="size-3.5" />
                        <span>{uploadingWp ? "Salvando…" : currentWallpaper ? "Trocar Imagem" : "Escolher Imagem"}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Predefinições Rápidas */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] text-muted-foreground mr-1">Predefinições:</span>
                    {WALLPAPER_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => void handleApplyPresetWallpaper(preset.value)}
                        className="text-[10px] rounded-md border border-border/60 bg-muted/40 hover:bg-muted px-2 py-0.5 text-foreground cursor-pointer transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Coluna 2: Setlist / Programação & Adição de Músicas */}
            <div className="flex flex-col h-full min-h-0 overflow-hidden bg-muted/5">
              {/* Header com botões de Adicionar */}
              <div className="px-4 py-2.5 border-b border-border bg-muted/15 flex items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Music className="size-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-xs font-semibold text-foreground truncate">
                      Programação do Culto
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      {totalSongs} {totalSongs === 1 ? "música" : "músicas"}{totalParts > 0 ? ` · ${totalParts} ${totalParts === 1 ? "momento" : "momentos"}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
                    onClick={() => {
                      setNewPartTitle("");
                      setNewPartDialogOpen(true);
                    }}
                  >
                    <FolderPlus className="size-3" />
                    <span>Novo Momento</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer font-semibold"
                    onClick={() => void handleOpenPicker()}
                  >
                    <Plus className="size-3.5" />
                    <span>Adicionar Música</span>
                  </Button>
                </div>
              </div>

              {/* Lista de Momentos e Músicas */}
              <ScrollArea className="flex-1 p-4">
                {loading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Carregando músicas do setlist…
                  </div>
                ) : !fullEvent || fullEvent.parts.length === 0 || totalSongs === 0 ? (
                  <div className="h-full min-h-[220px] rounded-xl border border-dashed border-border/80 bg-muted/15 p-6 flex flex-col items-center justify-center text-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Music className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Nenhuma música adicionada ainda
                      </p>
                      <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                        Você já pode montar o repertório deste culto agora mesmo.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 text-xs cursor-pointer font-semibold"
                        onClick={() => void handleOpenPicker()}
                      >
                        <Plus className="size-3.5" />
                        <span>Adicionar Música</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs cursor-pointer"
                        onClick={() => {
                          setNewPartTitle("");
                          setNewPartDialogOpen(true);
                        }}
                      >
                        <FolderPlus className="size-3.5" />
                        <span>Criar Momento</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {fullEvent.parts.map((part) => (
                      <div
                        key={part.id}
                        className="rounded-lg border border-border/70 bg-card overflow-hidden shadow-xs"
                      >
                        {/* Part Header */}
                        <div
                          className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold border-b border-border/40 bg-muted/20"
                          style={{
                            backgroundColor: part.bgColor || undefined,
                            color: part.color || undefined,
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <span className="truncate">{part.title || "Momento de Louvor"}</span>
                            <span className="text-[10px] opacity-70 font-normal shrink-0">
                              ({part.items.length})
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] gap-1 hover:bg-background/60 cursor-pointer"
                              onClick={() => void handleOpenPicker(part.id)}
                            >
                              <Plus className="size-3" />
                              <span>Música</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              title="Remover Momento"
                              onClick={() => void handleRemovePart(part.id)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Part Items */}
                        {part.items.length === 0 ? (
                          <div className="p-3 text-[11px] text-muted-foreground flex items-center justify-between">
                            <span className="italic">Nenhuma música neste momento.</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] gap-1 cursor-pointer"
                              onClick={() => void handleOpenPicker(part.id)}
                            >
                              <Plus className="size-2.5" />
                              <span>Adicionar</span>
                            </Button>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/30">
                            {part.items.map((item, itemIdx) => (
                              <div
                                key={item.id}
                                className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground shrink-0">
                                    {itemIdx + 1}
                                  </span>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-foreground truncate">
                                      {item.media?.title ||
                                        item.song?.title ||
                                        "Música sem título"}
                                    </span>
                                    {(item.media || item.song?.artist) && (
                                      <span className="text-[11px] text-muted-foreground truncate">
                                        {item.media
                                          ? mediaKindLabel(item.media.kind)
                                          : item.song?.artist}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                                    disabled={itemIdx === 0}
                                    title="Mover para cima"
                                    onClick={() => void handleMoveSong(part.id, itemIdx, -1)}
                                  >
                                    <ArrowUp className="size-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                                    disabled={itemIdx === part.items.length - 1}
                                    title="Mover para baixo"
                                    onClick={() => void handleMoveSong(part.id, itemIdx, 1)}
                                  >
                                    <ArrowDown className="size-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer ml-1"
                                    title="Remover música do setlist"
                                    onClick={() => void handleRemoveSong(part.id, item.id)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-3 border-t border-border bg-muted/10 flex items-center justify-between gap-2 sm:justify-between shrink-0">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs cursor-pointer"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              <span>Excluir Culto</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs cursor-pointer">
                Fechar
              </Button>
              {isActive ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold cursor-default bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                >
                  <Tv className="size-3.5" />
                  <span>Selecionado na Projeção</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs cursor-pointer font-semibold"
                  onClick={handleSelectActive}
                >
                  <Tv className="size-3.5" />
                  <span>Selecionar para Apresentação</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Song Picker Dialog */}
      <SongPickerDialog
        partId={pickerPartId || ""}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectSong={(song) => {
          if (pickerPartId) {
            void handleAddSong(pickerPartId, song);
          }
        }}
      />

      {/* New Part / Moment Dialog */}
      <Dialog open={newPartDialogOpen} onOpenChange={setNewPartDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Novo Momento do Culto</DialogTitle>
            <DialogDescription className="text-xs">
              Exemplos: Momento de Louvor, Ofertório, Ceia do Senhor.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Input
              autoFocus
              placeholder="Nome do momento"
              value={newPartTitle}
              onChange={(e) => setNewPartTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreatePart();
                }
              }}
            />

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_MOMENTS.map((mom) => (
                <button
                  key={mom}
                  type="button"
                  onClick={() => setNewPartTitle(mom)}
                  className="text-[10px] rounded-md border border-border/70 bg-muted/40 hover:bg-muted px-2 py-0.5 text-foreground cursor-pointer transition-colors"
                >
                  {mom}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewPartDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreatePart()}
            >
              Criar Momento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <EditEventDialog
        eventId={eventSummary.id}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          // Refresh event details
          void getEvent(eventSummary.id).then((ev) => setFullEvent(ev));
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive">
              Excluir Culto / Evento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tem certeza de que deseja excluir este evento da agenda?
            </DialogDescription>
          </DialogHeader>

          {isSeries ? (
            <div className="flex flex-col gap-3 py-2 text-xs">
              <p className="text-foreground">
                Este evento faz parte de uma série com <strong>{seriesEvents.length} cultos programados</strong> ({eventSummary.title}).
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteSeriesChoice("single")}
                  className={`flex flex-col items-center justify-center rounded-lg p-2.5 text-xs text-center border cursor-pointer transition-all ${
                    deleteSeriesChoice === "single"
                      ? "bg-secondary border-primary text-primary font-bold shadow-xs"
                      : "bg-background border-border text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  <span>Excluir apenas este</span>
                  <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                    Remove só a data {dt.formattedDate || eventSummary.eventDate}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteSeriesChoice("series")}
                  className={`flex flex-col items-center justify-center rounded-lg p-2.5 text-xs text-center border cursor-pointer transition-all ${
                    deleteSeriesChoice === "series"
                      ? "bg-secondary border-destructive text-destructive font-bold shadow-xs"
                      : "bg-background border-border text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  <span>Excluir toda a série</span>
                  <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                    Remove todos os {seriesEvents.length} cultos
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-muted-foreground">
              O evento &ldquo;{eventSummary.title}&rdquo; e seu repertório associado serão permanentemente removidos.
            </div>
          )}

          {linkedThemeGuid && (
            <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs text-foreground">
              <input
                type="checkbox"
                checked={deleteLinkedTheme}
                onChange={(event) => setDeleteLinkedTheme(event.target.checked)}
                className="size-4 accent-destructive"
              />
              Excluir também o tema vinculado
            </label>
          )}

          <DialogFooter className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
