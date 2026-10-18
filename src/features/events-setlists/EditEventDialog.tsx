import { useEffect, useState } from "react";
import { Calendar, Clock, Edit3, Repeat } from "lucide-react";
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
import { getEvent } from "@/core/ipc/commands";
import { useSetlistStore } from "./store";
import type { ServiceEvent } from "@/core/types";

interface EditEventDialogProps {
  eventId: string | null;
  open: boolean;
  onClose: () => void;
}

export function EditEventDialog({ eventId, open, onClose }: EditEventDialogProps) {
  const events = useSetlistStore((s) => s.events);
  const updateEventDetails = useSetlistStore((s) => s.updateEventDetails);
  const updateRecurringSeries = useSetlistStore((s) => s.updateRecurringSeries);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [originalEvent, setOriginalEvent] = useState<ServiceEvent | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [applyScope, setApplyScope] = useState<"single" | "series">("single");

  // Number of events sharing the original title
  const seriesEvents = events.filter((e) => originalEvent && e.title === originalEvent.title);
  const isSeries = seriesEvents.length > 1;

  useEffect(() => {
    if (!open || !eventId) {
      setOriginalEvent(null);
      return;
    }

    setLoading(true);
    setApplyScope("single");

    void getEvent(eventId).then((ev) => {
      setLoading(false);
      if (!ev) return;
      setOriginalEvent(ev);
      setTitle(ev.title);

      const ed = ev.eventDate;
      if (ed.includes("/")) {
        const [s, e] = ed.split("/");
        const [d, t] = s.split("T");
        setDate(d || "");
        setStartTime(t?.slice(0, 5) || "18:00");
        if (e.includes("T")) {
          setEndTime(e.split("T")[1]?.slice(0, 5) || "20:00");
        }
      } else if (ed.includes("T")) {
        const [d, t] = ed.split("T");
        setDate(d || "");
        setStartTime(t?.slice(0, 5) || "18:00");
        const [h, m] = (t || "18:00").split(":").map(Number);
        const pad = (n: number) => String(n).padStart(2, "0");
        setEndTime(`${pad((h + 2) % 24)}:${pad(m || 0)}`);
      } else {
        setDate(ed);
        setStartTime("18:00");
        setEndTime("20:00");
      }
    });
  }, [open, eventId]);

  function handleStartTimeChange(newStartTime: string) {
    setStartTime(newStartTime);
    if (newStartTime && (!endTime || endTime <= newStartTime)) {
      const [h, m] = newStartTime.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      const endH = (h + 2) % 24;
      setEndTime(`${pad(endH)}:${pad(m || 0)}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Informe o título do evento.");
      return;
    }

    if (!eventId || !originalEvent) return;

    setSubmitting(true);
    try {
      if (applyScope === "series" && isSeries) {
        await updateRecurringSeries(originalEvent.title, {
          title: cleanTitle,
          timeInterval: startTime && endTime ? `${startTime}/${endTime}` : startTime || undefined,
        });
        toast.success(`Todos os ${seriesEvents.length} eventos da série foram atualizados!`);
      } else {
        const fullDateStr =
          date && startTime
            ? (endTime ? `${date}T${startTime}/${date}T${endTime}` : `${date}T${startTime}`)
            : date;

        await updateEventDetails(eventId, {
          title: cleanTitle,
          eventDate: fullDateStr,
        });
        toast.success("Evento atualizado com sucesso!");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar alterações no evento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Edit3 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Editar Evento / Culto</DialogTitle>
              <DialogDescription className="text-xs">
                Atualize o título, data e horários deste culto ou de toda a série recorrente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Carregando dados do evento…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
            {/* Título */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Título do Evento</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex.: Culto de Domingo, Culto de Quarta"
              />
            </div>

            {/* Escopo de Aplicação se for Recorrente */}
            {isSeries && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Repeat className="size-3.5" />
                    <span>Evento Recorrente Detectado</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-medium">
                    {seriesEvents.length} cultos nesta série
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Deseja aplicar estas alterações apenas a este evento ou a todas as repetições?
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setApplyScope("single")}
                    className={`flex flex-col items-center justify-center rounded-lg p-2.5 text-xs text-center border cursor-pointer transition-all ${
                      applyScope === "single"
                        ? "bg-secondary border-primary text-primary font-bold shadow-xs"
                        : "bg-background/80 border-border/70 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <span>Apenas este culto</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Altera data, hora e título só aqui
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApplyScope("series")}
                    className={`flex flex-col items-center justify-center rounded-lg p-2.5 text-xs text-center border cursor-pointer transition-all ${
                      applyScope === "series"
                        ? "bg-secondary border-primary text-primary font-bold shadow-xs"
                        : "bg-background/80 border-border/70 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <span>Toda a série</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Atualiza horários e nome em todas as datas
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Data e Horários */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>Data</span>
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={applyScope === "series"}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span>Início</span>
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span>Término</span>
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {applyScope === "series" && (
              <p className="text-[11px] text-muted-foreground italic">
                * As datas individuais de cada culto no calendário são preservadas; os horários de início e término serão sincronizados em todas as ocorrências.
              </p>
            )}

            <DialogFooter className="mt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
                {submitting ? "Salvando…" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
