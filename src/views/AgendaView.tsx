import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaCalendar } from "@/features/events-setlists/AgendaCalendar";
import { isTauri } from "@/core/ipc/tauri";
import { closeAgendaWindow } from "@/core/ipc/commands";

export function AgendaView() {
  const handleClose = () => {
    if (isTauri()) {
      void closeAgendaWindow();
    } else {
      window.close();
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header da Janela de Agenda */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 select-none">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <CalendarIcon className="size-4" />
          </div>
          <div>
            <h1 className="text-xs font-semibold text-foreground">
              Agenda de Eventos & Cultos
            </h1>
            <p className="text-[10px] text-muted-foreground">
              Planejamento, programação e cronograma de cultos
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleClose}
          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          title="Fechar Janela"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Calendário da Agenda */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AgendaCalendar />
      </div>
    </div>
  );
}
