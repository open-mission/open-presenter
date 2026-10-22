import { useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Image as ImageIcon,
  ListX,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { EventSummary } from "@/core/types";
import { EventDetailsDialog } from "./EventDetailsDialog";
import { formatEventDateTime } from "./dateUtils";
import { useSetlistStore } from "./store";

interface EventGroup {
  title: string;
  events: EventSummary[];
}

function groupEventsByTitle(events: EventSummary[]): EventGroup[] {
  const groups = new Map<string, EventSummary[]>();
  for (const summary of events) {
    const key = summary.title.trim();
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(summary);
    } else {
      groups.set(key, [summary]);
    }
  }
  return Array.from(groups, ([title, items]) => ({ title, events: items }));
}

function itemCountLabel(count: number): string {
  if (count === 0) return "sem itens";
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

function EventMenuItem({
  event: eventSummary,
  selected,
}: {
  event: EventSummary;
  selected: boolean;
}) {
  const dt = formatEventDateTime(eventSummary.eventDate);
  return (
    <DropdownMenuItem
      onSelect={() => void useSetlistStore.getState().selectEvent(eventSummary.id)}
      className={`flex items-center justify-between gap-2 py-2 px-2.5 text-xs cursor-pointer ${
        selected ? "bg-accent/60 font-semibold" : ""
      }`}
    >
      <div className="flex flex-col min-w-0 pr-2">
        <span className="font-semibold text-foreground truncate">
          {eventSummary.title}
        </span>
        {dt.displaySummary && (
          <span className="text-[11px] text-muted-foreground truncate">
            {dt.displaySummary}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground truncate">
          {itemCountLabel(eventSummary.itemCount ?? 0)}
        </span>
      </div>
      {selected && <Check className="size-4 text-primary shrink-0" />}
    </DropdownMenuItem>
  );
}

export function SetlistSelector() {
  const events = useSetlistStore((s) => s.events);
  const event = useSetlistStore((s) => s.event);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const listMode = useSetlistStore((s) => s.listMode);
  const clearTemporary = useSetlistStore((s) => s.clearTemporary);
  const deleteEvent = useSetlistStore((s) => s.deleteEvent);
  const clearEventItems = useSetlistStore((s) => s.clearEventItems);
  const save = useSetlistStore((s) => s.save);

  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [clearListDialogOpen, setClearListDialogOpen] = useState(false);

  const eventGroups = groupEventsByTitle(events);
  const totalEventItems =
    event?.parts.reduce((sum, p) => sum + p.items.length, 0) ?? 0;

  async function handleClearTemporary() {
    await clearTemporary();
    toast.success("Lista temporária limpa.");
  }

  function handleClearEventItems() {
    clearEventItems();
    setClearListDialogOpen(false);
    void save();
    toast.success("Programação do culto limpa.");
  }

  return (
    <>
      {listMode === "temporary" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex flex-col justify-center text-left transition-colors outline-none cursor-pointer h-9 px-2 rounded-md hover:bg-accent/60 max-w-[200px] sm:max-w-[240px] md:max-w-[280px]"
              title="Lista Temporária (Avulsa)"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-tight text-foreground group-hover:text-primary transition-colors min-w-0">
                <span className="truncate">Lista Temporária</span>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-3.5 border-amber-500/40 text-amber-500 bg-amber-500/10 font-normal"
                >
                  Avulsa
                </Badge>
                <span className="text-[10px] text-muted-foreground truncate">
                  Sem vínculo a culto
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 sm:w-80 max-h-[65vh] overflow-y-auto">
            <DropdownMenuItem
              onSelect={() => void handleClearTemporary()}
              className="text-xs text-destructive focus:text-destructive cursor-pointer py-1.5"
            >
              <Trash2 className="size-3.5 mr-2" />
              <span>Limpar lista temporária</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Alternar para Culto / Evento
            </div>
            {eventGroups.map((group) =>
              group.events.length === 1 ? (
                <EventMenuItem
                  key={group.events[0].id}
                  event={group.events[0]}
                  selected={group.events[0].id === activeEventId}
                />
              ) : (
                <DropdownMenuSub key={group.title}>
                  <DropdownMenuSubTrigger
                    className={`flex items-center gap-2 px-2.5 py-2 text-xs cursor-pointer outline-none ${
                      group.events.some((ev) => ev.id === activeEventId)
                        ? "bg-accent/60"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold text-foreground truncate">
                          {group.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {group.events.length}{" "}
                          {group.events.length === 1 ? "data" : "datas"}
                        </span>
                      </div>
                      {group.events.some((ev) => ev.id === activeEventId) && (
                        <Check className="size-4 text-primary shrink-0" />
                      )}
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    align="start"
                    sideOffset={4}
                    className="w-64 max-h-[60vh] overflow-y-auto"
                  >
                    {group.events.map((ev) => (
                      <EventMenuItem
                        key={ev.id}
                        event={ev}
                        selected={ev.id === activeEventId}
                      />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ),
            )}
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
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex flex-col justify-center text-left transition-colors outline-none cursor-pointer h-9 px-2 rounded-md hover:bg-accent/60 max-w-[200px] sm:max-w-[240px] md:max-w-[280px]"
              title="Programação do Culto"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-tight text-foreground group-hover:text-primary transition-colors min-w-0">
                <span className="truncate">
                  {event?.title || "Programação do Culto"}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </div>
              {event?.eventDate && (
                <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground truncate leading-none mt-0.5">
                  {formatEventDateTime(event.eventDate).displaySummary}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 sm:w-80 max-h-[65vh] overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cultos & Eventos
            </div>
            {eventGroups.map((group) =>
              group.events.length === 1 ? (
                <EventMenuItem
                  key={group.events[0].id}
                  event={group.events[0]}
                  selected={group.events[0].id === activeEventId}
                />
              ) : (
                <DropdownMenuSub key={group.title}>
                  <DropdownMenuSubTrigger
                    className={`flex items-center gap-2 px-2.5 py-2 text-xs cursor-pointer outline-none ${
                      group.events.some((ev) => ev.id === activeEventId)
                        ? "bg-accent/60"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold text-foreground truncate">
                          {group.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {group.events.length}{" "}
                          {group.events.length === 1 ? "data" : "datas"}
                        </span>
                      </div>
                      {group.events.some((ev) => ev.id === activeEventId) && (
                        <Check className="size-4 text-primary shrink-0" />
                      )}
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    align="start"
                    sideOffset={4}
                    className="w-64 max-h-[60vh] overflow-y-auto"
                  >
                    {group.events.map((ev) => (
                      <EventMenuItem
                        key={ev.id}
                        event={ev}
                        selected={ev.id === activeEventId}
                      />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ),
            )}
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
            {event && <DropdownMenuSeparator />}
            {event && (
              <DropdownMenuItem
                onSelect={() => setClearListDialogOpen(true)}
                className="text-xs text-destructive focus:text-destructive cursor-pointer py-1.5"
              >
                <ListX className="size-3.5 mr-2" />
                <span>Limpar Programação</span>
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

      {/* Clear List Confirmation Dialog */}
      <Dialog open={clearListDialogOpen} onOpenChange={setClearListDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ListX className="size-4 text-destructive" />
              <span>Limpar Programação</span>
            </DialogTitle>
            <DialogDescription>
              Todos os {totalEventItems} itens de "
              {event?.title ?? "Programação do Culto"}" serão removidos. As
              seções da programação são mantidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setClearListDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleClearEventItems}
            >
              Limpar Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event details and wallpaper configuration */}
      {event && (
        <EventDetailsDialog
          eventSummary={event}
          open={eventDetailsOpen}
          onClose={() => setEventDetailsOpen(false)}
        />
      )}
    </>
  );
}
