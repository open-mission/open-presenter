import { useEffect, useState } from "react";
import {
  Clock,
  Hourglass,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  timerPause,
  timerReset,
  timerSetCountdown,
  timerStart,
} from "@/core/ipc/commands";
import { formatElapsed } from "@/core/lib/format";
import { stageTimerElapsed, stageTimerRemaining, type StageTimer } from "@/core/types";
import { useStageTimerStore } from "@/features/stage-display/timerStore";

const COUNTDOWN_PRESETS = [
  { label: "5m", secs: 5 * 60 },
  { label: "10m", secs: 10 * 60 },
  { label: "15m", secs: 15 * 60 },
  { label: "20m", secs: 20 * 60 },
  { label: "30m", secs: 30 * 60 },
  { label: "45m", secs: 45 * 60 },
  { label: "60m", secs: 60 * 60 },
];

export function TimersAdjustmentTab() {
  const timer = useStageTimerStore((s) => s.timer);
  const [now, setNow] = useState(() => Date.now());
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function apply(promise: Promise<StageTimer | null>) {
    const next = await promise;
    if (next) useStageTimerStore.getState().applyRemote(next);
  }

  const isCountdown = Boolean(timer.countdownSecs && timer.countdownSecs > 0);
  const formattedTime = isCountdown
    ? formatElapsed(stageTimerRemaining(timer, now))
    : formatElapsed(stageTimerElapsed(timer, now));

  const isZero = isCountdown && stageTimerRemaining(timer, now) === 0;

  function handleSetCountdown(secs: number) {
    void apply(timerSetCountdown(secs));
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mins = Math.max(0, Number(customMinutes) || 0);
    if (mins > 0) {
      handleSetCountdown(mins * 60);
      setCustomMinutes("");
    }
  }

  const currentWallClock = new Date(now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-2.5 text-xs select-none">
      {/* Timer Display & Main Controls */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            {isCountdown ? (
              <Hourglass className="size-3.5 text-amber-400" />
            ) : (
              <TimerIcon className="size-3.5 text-sky-400" />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {isCountdown ? "Contagem Regressiva" : "Cronômetro Palco"}
            </span>
            {timer.running && (
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div
            className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
              isZero
                ? "text-red-500 animate-pulse"
                : timer.running
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {formattedTime}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={timer.running ? "outline" : "default"}
            onClick={() => void apply(timer.running ? timerPause() : timerStart())}
            className="h-8 gap-1.5 px-3 font-semibold cursor-pointer shadow-xs"
          >
            {timer.running ? (
              <>
                <Pause className="size-3.5" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                <span>Iniciar</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void apply(timerReset())}
            className="h-8 size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Zerar cronômetro"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Mode & Preset Selection */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Predefinições Rápidas
          </span>
          <button
            type="button"
            onClick={() => handleSetCountdown(0)}
            className={`text-[10px] font-medium hover:underline cursor-pointer ${
              !isCountdown ? "text-sky-400 font-semibold" : "text-muted-foreground"
            }`}
          >
            Modo Livre (Crescente)
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {COUNTDOWN_PRESETS.map((p) => {
            const isCurrent = isCountdown && timer.countdownSecs === p.secs;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSetCountdown(p.secs)}
                className={`flex h-7 items-center justify-center rounded border text-xs font-semibold transition-all cursor-pointer ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Duration & Clock Banner */}
      <div className="flex items-center justify-between gap-2">
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 flex-1">
          <Input
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            type="number"
            min="1"
            max="300"
            placeholder="Minutos personalizados…"
            className="h-7 text-xs bg-muted/40"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!customMinutes}
            className="h-7 text-xs cursor-pointer shrink-0"
          >
            Definir
          </Button>
        </form>

        <div className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1 text-[11px] font-mono text-muted-foreground shrink-0 border border-border/50">
          <Clock className="size-3 text-muted-foreground" />
          <span>{currentWallClock}</span>
        </div>
      </div>
    </div>
  );
}
