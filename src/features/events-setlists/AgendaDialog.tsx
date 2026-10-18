import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSetlistStore } from "./store";
import { AgendaCalendar } from "./AgendaCalendar";

export function AgendaDialog() {
  const open = useSetlistStore((s) => s.agendaOpen);
  const close = useSetlistStore((s) => s.closeAgenda);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[85vw] sm:max-w-[78vw] md:max-w-[75vw] h-[75vh] max-h-[82vh] p-0 overflow-hidden flex flex-col rounded-xl shadow-2xl border-border bg-background">
        <AgendaCalendar onSelectAndSwitch={() => close()} />
      </DialogContent>
    </Dialog>
  );
}
