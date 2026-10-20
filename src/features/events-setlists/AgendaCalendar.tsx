import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { EventDropArg } from "@fullcalendar/core";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSetlistStore } from "./store";
import { EventDetailsDialog } from "./EventDetailsDialog";
import type { EventSummary } from "@/core/types";
import { usePreferencesStore } from "@/features/preferences/store";

interface AgendaCalendarProps {
  onSelectAndSwitch?: () => void;
}

export function AgendaCalendar({ onSelectAndSwitch }: AgendaCalendarProps) {
  const events = useSetlistStore((s) => s.events);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const updateEventDate = useSetlistStore((s) => s.updateEventDate);
  const openNewEventDialog = useSetlistStore((s) => s.openNewEventDialog);
  const weekStart = usePreferencesStore((s) => s.weekStart);

  const [clickedEvent, setClickedEvent] = useState<EventSummary | null>(null);

  const activeEvent = events.find((e) => e.id === activeEventId);

  // Map events to FullCalendar event format with start/end interval support
  const calendarEvents = events.map((ev) => {
    const isActive = ev.id === activeEventId;
    let start = ev.eventDate;
    let end: string | undefined = undefined;
    if (ev.eventDate.includes("/")) {
      const parts = ev.eventDate.split("/");
      start = parts[0];
      end = parts[1];
    }
    const hasTime = start.includes("T");
    return {
      id: ev.id,
      title: ev.title,
      start,
      end,
      allDay: !hasTime,
      backgroundColor: isActive ? "var(--primary)" : "var(--card)",
      borderColor: isActive ? "var(--primary)" : "var(--border)",
      textColor: isActive ? "var(--primary-foreground)" : "var(--foreground)",
      className: isActive ? "font-semibold ring-1 ring-primary" : "",
      extendedProps: {
        raw: ev,
      },
    };
  });

  async function handleEventDrop(dropInfo: EventDropArg) {
    const eventId = dropInfo.event.id;
    const startStr = dropInfo.event.startStr;
    const endStr = dropInfo.event.endStr;
    const newDate = endStr ? `${startStr}/${endStr}` : startStr;
    try {
      await updateEventDate(eventId, newDate);
      toast.success("Data do evento atualizada!");
    } catch {
      dropInfo.revert();
      toast.error("Erro ao atualizar data do evento.");
    }
  }

  function handleDateClick(arg: DateClickArg) {
    // When created from calendar/agenda, do not auto-select the event on main screen
    openNewEventDialog(arg.dateStr, false);
  }

  function handleEventClick(info: { event: { id: string } }) {
    const found = events.find((e) => e.id === info.event.id);
    if (found) {
      setClickedEvent(found);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Calendar Toolbar / Info Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pl-4 pr-14 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Agenda & Cronograma de Cultos
            </h2>
            <p className="text-xs text-muted-foreground">
              Arraste eventos para reagendar ou clique em qualquer dia para criar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeEvent && (
            <div className="hidden sm:flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-muted-foreground">Culto Ativo:</span>
              <span className="font-semibold text-foreground max-w-[160px] truncate">
                {activeEvent.title}
              </span>
            </div>
          )}

          <Button
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={() => openNewEventDialog(undefined, false)}
          >
            <Plus className="size-3.5" />
            <span>Novo Evento</span>
          </Button>
        </div>
      </div>

      {/* Main FullCalendar container */}
      <div className="flex-1 overflow-hidden p-4 min-h-0">
        <div className="h-full w-full">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            firstDay={weekStart === "monday" ? 1 : 0}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            locales={[ptBrLocale]}
            locale="pt-br"
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia",
              list: "Agenda",
            }}
            editable={true}
            droppable={true}
            selectable={true}
            height="100%"
            events={calendarEvents}
            eventDrop={handleEventDrop}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            dayMaxEvents={4}
          />
        </div>
      </div>

      {/* Event Details, Edit & Wallpaper Modal */}
      <EventDetailsDialog
        eventSummary={clickedEvent}
        open={Boolean(clickedEvent)}
        onClose={() => setClickedEvent(null)}
        onSelectAndSwitch={onSelectAndSwitch}
      />
    </div>
  );
}
