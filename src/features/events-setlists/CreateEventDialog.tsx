import { useEffect, useMemo, useState } from "react";
import { Clock, Repeat, CalendarDays, Check, Info } from "lucide-react";
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
import {
  useSetlistStore,
  generateRecurrenceDates,
  type RecurrenceFrequency,
  type MonthlyRecurrenceMode,
} from "./store";
import { formatEventDateTime } from "./dateUtils";
import { EventThemeSelect } from "./EventThemeSelect";

const WEEKDAYS = [
  { short: "D", label: "Dom", full: "Domingo", value: 0 },
  { short: "S", label: "Seg", full: "Segunda", value: 1 },
  { short: "T", label: "Ter", full: "Terça", value: 2 },
  { short: "Q", label: "Qua", full: "Quarta", value: 3 },
  { short: "Q", label: "Qui", full: "Quinta", value: 4 },
  { short: "S", label: "Sex", full: "Sexta", value: 5 },
  { short: "S", label: "Sáb", full: "Sábado", value: 6 },
];

const NTH_OPTIONS = [
  { label: "1º (Primeiro)", value: 1 },
  { label: "2º (Segundo)", value: 2 },
  { label: "3º (Terceiro)", value: 3 },
  { label: "4º (Quarto)", value: 4 },
  { label: "Último", value: -1 },
];

function parseInitialDateTime(initialDate?: string | null): {
  date: string;
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  let date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let startTime = "18:00";
  let endTime = "20:00";

  if (initialDate) {
    if (initialDate.includes("/")) {
      const [startPart, endPart] = initialDate.split("/");
      if (startPart.includes("T")) {
        const [d, t] = startPart.split("T");
        date = d;
        startTime = t.slice(0, 5);
      } else {
        date = startPart;
      }
      if (endPart.includes("T")) {
        endTime = endPart.split("T")[1].slice(0, 5);
      }
    } else if (initialDate.includes("T")) {
      const [d, t] = initialDate.split("T");
      date = d;
      startTime = t.slice(0, 5);
      const [h, m] = startTime.split(":").map(Number);
      const endH = (h + 2) % 24;
      endTime = `${pad(endH)}:${pad(m || 0)}`;
    } else {
      date = initialDate.slice(0, 10);
      startTime = "18:00";
      endTime = "20:00";
    }
  }

  return { date, startTime, endTime };
}

function defaultEndDate(startStr: string): string {
  const d = new Date(startStr);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + 3);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CreateEventDialog() {
  const open = useSetlistStore((s) => s.newEventDialogOpen);
  const initialDate = useSetlistStore((s) => s.newEventInitialDate);
  const close = useSetlistStore((s) => s.closeNewEventDialog);
  const createRecurringEvents = useSetlistStore((s) => s.createRecurringEvents);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("none");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);

  // Monthly settings
  const [monthlyMode, setMonthlyMode] = useState<MonthlyRecurrenceMode>("day_of_month");
  const [customMonthly, setCustomMonthly] = useState(false);
  const [monthlyNth, setMonthlyNth] = useState<number>(1);
  const [monthlyWeekday, setMonthlyWeekday] = useState<number>(0);

  // End settings (Google Calendar style: until date vs count)
  const [endMode, setEndMode] = useState<"until_date" | "count">("until_date");
  const [untilDate, setUntilDate] = useState("");
  const [count, setCount] = useState<number>(6);
  const [themeGuid, setThemeGuid] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      const parsed = parseInitialDateTime(initialDate);
      setDate(parsed.date);
      setStartTime(parsed.startTime);
      setEndTime(parsed.endTime);
      setUntilDate(defaultEndDate(parsed.date));
      setRecurrence("none");
      setEndMode("until_date");
      setCount(6);
      setCustomMonthly(false);
      setThemeGuid(null);
      setSubmitting(false);

      const d = new Date(`${parsed.date}T${parsed.startTime || "00:00"}`);
      if (!isNaN(d.getTime())) {
        const wday = d.getDay();
        const nth = Math.min(4, Math.max(1, Math.ceil(d.getDate() / 7)));
        setSelectedWeekdays([wday]);
        setMonthlyWeekday(wday);
        setMonthlyNth(nth);
      }
    }
  }, [open, initialDate]);

  const fullDateStr = useMemo(() => {
    if (!date) return "";
    if (startTime && endTime) {
      return `${date}T${startTime}/${date}T${endTime}`;
    }
    if (startTime) {
      return `${date}T${startTime}`;
    }
    return date;
  }, [date, startTime, endTime]);

  // Derived date info for current start date
  const parsedStartDate = useMemo(() => {
    if (!date) return null;
    const d = new Date(`${date}T${startTime || "12:00"}`);
    if (isNaN(d.getTime())) return null;
    const wday = d.getDay();
    const day = d.getDate();
    const nth = Math.min(4, Math.max(1, Math.ceil(day / 7)));
    return {
      date: d,
      weekday: wday,
      dayOfMonth: day,
      nthIndex: nth,
      weekdayName: WEEKDAYS[wday]?.full || "Dia",
      nthName: `${nth}º`,
    };
  }, [date, startTime]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    const d = new Date(`${newDate}T${startTime || "00:00"}`);
    if (!isNaN(d.getTime())) {
      const wday = d.getDay();
      const nth = Math.min(4, Math.max(1, Math.ceil(d.getDate() / 7)));
      setSelectedWeekdays([wday]);
      setMonthlyWeekday(wday);
      setMonthlyNth(nth);
      if (!untilDate) {
        setUntilDate(defaultEndDate(newDate));
      }
    }
  }

  function handleStartTimeChange(newStartTime: string) {
    setStartTime(newStartTime);
    if (newStartTime && (!endTime || endTime <= newStartTime)) {
      const [h, m] = newStartTime.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      const endH = (h + 2) % 24;
      setEndTime(`${pad(endH)}:${pad(m || 0)}`);
    }
  }

  function toggleWeekday(wday: number) {
    setSelectedWeekdays((prev) => {
      if (prev.includes(wday)) {
        if (prev.length === 1) return prev; // At least one day selected
        return prev.filter((d) => d !== wday);
      }
      return [...prev, wday].sort((a, b) => a - b);
    });
  }

  // Calculate live preview of recurring dates
  const calculatedDates = useMemo(() => {
    if (!fullDateStr || !parsedStartDate) return [];
    return generateRecurrenceDates({
      title: title || "Culto",
      startDate: fullDateStr,
      recurrence,
      weekdays: selectedWeekdays,
      monthlyMode: customMonthly ? "nth_weekday" : monthlyMode,
      monthlyNth,
      monthlyWeekday,
      endMode,
      untilDate,
      count,
    });
  }, [
    fullDateStr,
    parsedStartDate,
    title,
    recurrence,
    selectedWeekdays,
    monthlyMode,
    customMonthly,
    monthlyNth,
    monthlyWeekday,
    endMode,
    untilDate,
    count,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Informe o título do evento.");
      return;
    }

    if (calculatedDates.length === 0) {
      toast.error("Nenhuma data válida encontrada para a recorrência.");
      return;
    }

    setSubmitting(true);
    try {
      const ids = await createRecurringEvents({
        title: cleanTitle,
        startDate: fullDateStr,
        recurrence,
        weekdays: selectedWeekdays,
        monthlyMode: customMonthly ? "nth_weekday" : monthlyMode,
        monthlyNth,
        monthlyWeekday,
        endMode,
        untilDate,
        count,
        themeGuid,
      });

      if (ids.length > 1) {
        toast.success(`${ids.length} cultos criados na agenda com setlists independentes!`);
      } else {
        toast.success(`Evento "${cleanTitle}" criado com sucesso!`);
      }
      close();
    } catch {
      toast.error("Erro ao criar eventos.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDisplayDate(dateStr: string): string {
    return formatEventDateTime(dateStr).displaySummary;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Novo Culto ou Evento</DialogTitle>
              <DialogDescription className="text-xs">
                Configure data, horários e opções avançadas de repetição no estilo Google Agenda.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Título do Evento */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Título do Evento / Culto
            </label>
            <Input
              autoFocus
              placeholder="ex.: Culto de Domingo, Culto de Quarta, Louvor & Adoração"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Tema do evento (opcional)
            </label>
            <EventThemeSelect value={themeGuid} onChange={setThemeGuid} />
            <p className="text-[11px] text-muted-foreground">
              Vale para os cultos criados nesta série. Contextos ausentes usam o tema das configurações.
            </p>
          </div>

          {/* Data, Horário de Início e Término */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                <span>Data</span>
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
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

          {/* Frequência de Recorrência */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Repeat className="size-3.5 text-primary" />
                <span>Recorrência</span>
              </label>
              <Badge variant="outline" className="text-[10px] font-normal border-primary/30 text-primary">
                Setlists separados
              </Badge>
            </div>

            {/* Selector de Frequência */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <Button
                type="button"
                variant={recurrence === "none" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                onClick={() => setRecurrence("none")}
              >
                Único
              </Button>
              <Button
                type="button"
                variant={recurrence === "weekly" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                onClick={() => setRecurrence("weekly")}
              >
                Semanal
              </Button>
              <Button
                type="button"
                variant={recurrence === "biweekly" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                onClick={() => setRecurrence("biweekly")}
              >
                Quinzenal
              </Button>
              <Button
                type="button"
                variant={recurrence === "monthly" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                onClick={() => setRecurrence("monthly")}
              >
                Mensal
              </Button>
            </div>

            {/* Painel Específico: SEMANAL ou QUINZENAL */}
            {(recurrence === "weekly" || recurrence === "biweekly") && (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Repetir nos dias da semana:
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {recurrence === "weekly" ? "A cada semana" : "A cada 2 semanas"}
                  </span>
                </div>

                {/* Botões dos dias da semana D S T Q Q S S */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {WEEKDAYS.map((w) => {
                    const isSelected = selectedWeekdays.includes(w.value);
                    return (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => toggleWeekday(w.value)}
                        className={`flex size-9 flex-col items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs scale-105"
                            : "border border-border/60 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                        title={w.full}
                      >
                        <span>{w.short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Painel Específico: MENSAL */}
            {recurrence === "monthly" && parsedStartDate && (
              <div className="mt-2 flex flex-col gap-2.5 rounded-lg border border-border/50 bg-background/60 p-3 text-xs">
                <span className="font-medium text-foreground">
                  Como deve se repetir a cada mês?
                </span>

                <div className="space-y-1.5">
                  {/* Opção 1: No mesmo dia do mês (ex: Todo dia 18) */}
                  <label className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted/40 transition-colors">
                    <input
                      type="radio"
                      name="monthlyOption"
                      checked={!customMonthly && monthlyMode === "day_of_month"}
                      onChange={() => {
                        setCustomMonthly(false);
                        setMonthlyMode("day_of_month");
                      }}
                      className="accent-primary"
                    />
                    <span className="text-foreground">
                      No <strong>dia {parsedStartDate.dayOfMonth}</strong> de cada mês
                    </span>
                  </label>

                  {/* Opção 2: Na posição da semana (ex: No 3º domingo de cada mês) */}
                  <label className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted/40 transition-colors">
                    <input
                      type="radio"
                      name="monthlyOption"
                      checked={!customMonthly && monthlyMode === "nth_weekday"}
                      onChange={() => {
                        setCustomMonthly(false);
                        setMonthlyMode("nth_weekday");
                        setMonthlyNth(parsedStartDate.nthIndex);
                        setMonthlyWeekday(parsedStartDate.weekday);
                      }}
                      className="accent-primary"
                    />
                    <span className="text-foreground">
                      No <strong>{parsedStartDate.nthName} {parsedStartDate.weekdayName.toLowerCase()}</strong> de cada mês
                    </span>
                  </label>

                  {/* Opção 3: Personalizado */}
                  <label className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted/40 transition-colors">
                    <input
                      type="radio"
                      name="monthlyOption"
                      checked={customMonthly}
                      onChange={() => setCustomMonthly(true)}
                      className="accent-primary"
                    />
                    <span className="text-foreground">Personalizado…</span>
                  </label>

                  {customMonthly && (
                    <div className="ml-6 mt-1 flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/30 p-2">
                      <span className="text-muted-foreground">Sempre no</span>
                      <select
                        value={monthlyNth}
                        onChange={(e) => setMonthlyNth(Number(e.target.value))}
                        className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
                      >
                        {NTH_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={monthlyWeekday}
                        onChange={(e) => setMonthlyWeekday(Number(e.target.value))}
                        className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
                      >
                        {WEEKDAYS.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.full}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted-foreground">do mês</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Término da Recorrência (Termina em) */}
            {recurrence !== "none" && (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-3 text-xs">
                <span className="font-medium text-foreground">Termina em:</span>

                <div className="space-y-2">
                  {/* Opção A: Em uma data final (Até dia X) */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "until_date"}
                      onChange={() => setEndMode("until_date")}
                      className="accent-primary"
                    />
                    <span className="text-muted-foreground">Em uma data específica:</span>
                    <Input
                      type="date"
                      value={untilDate}
                      disabled={endMode !== "until_date"}
                      onChange={(e) => setUntilDate(e.target.value)}
                      className="h-7 w-40 text-xs bg-background ml-auto"
                    />
                  </label>

                  {/* Opção B: Após X ocorrências */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "count"}
                      onChange={() => setEndMode("count")}
                      className="accent-primary"
                    />
                    <span className="text-muted-foreground">Após um número de cultos:</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        max={104}
                        value={count}
                        disabled={endMode !== "count"}
                        onChange={(e) => setCount(Math.max(1, Math.min(104, Number(e.target.value) || 1)))}
                        className="h-7 w-20 text-center text-xs bg-background"
                      />
                      <span className="text-muted-foreground text-[11px]">vezes</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Resumo & Pré-visualização das Datas Geradas */}
            {recurrence !== "none" && (
              <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary flex items-center gap-1.5">
                    <Check className="size-3.5" />
                    <span>
                      {calculatedDates.length}{" "}
                      {calculatedDates.length === 1 ? "culto será gerado" : "cultos serão gerados"}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Datas programadas:
                  </span>
                </div>

                {calculatedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 text-[11px]">
                    {calculatedDates.slice(0, 8).map((dStr, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-background border border-border/60 px-1.5 py-0.5 font-mono text-muted-foreground"
                      >
                        {formatDisplayDate(dStr)}
                      </span>
                    ))}
                    {calculatedDates.length > 8 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-medium">
                        +{calculatedDates.length - 8} outros
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground border-t border-primary/10 pt-1.5">
                  <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Cada evento gerado possui setlist e repertório 100% independente. Alterações em um culto não afetam os outros.
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={close}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !title.trim() || calculatedDates.length === 0}
            >
              {submitting
                ? "Criando…"
                : calculatedDates.length > 1
                ? `Criar ${calculatedDates.length} Eventos`
                : "Criar Evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
