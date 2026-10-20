import { useEffect, useState } from "react";
import {
  ChevronDown,
  Hourglass,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  timerPause,
  timerReset,
  timerSetCountdown,
  timerStart,
} from "@/core/ipc/commands";
import { formatElapsed } from "@/core/lib/format";
import { stageTimerElapsed, stageTimerRemaining, type StageTimer } from "@/core/types";
import { useStageTimerStore } from "./timerStore";

const COUNTDOWN_PRESETS = [
  { label: "Cronômetro crescente (00:00)", secs: 0 },
  { label: "5 minutos", secs: 5 * 60 },
  { label: "10 minutos", secs: 10 * 60 },
  { label: "15 minutos", secs: 15 * 60 },
  { label: "20 minutos", secs: 20 * 60 },
  { label: "30 minutos", secs: 30 * 60 },
  { label: "45 minutos", secs: 45 * 60 },
  { label: "60 minutos", secs: 60 * 60 },
];

export function HeaderTimerControls() {
  const timer = useStageTimerStore((s) => s.timer);
  const [now, setNow] = useState(() => Date.now());
  const [customMinutes, setCustomMinutes] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

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
    setShowCustomInput(false);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mins = Math.max(0, Number(customMinutes) || 0);
    handleSetCountdown(mins * 60);
    setCustomMinutes("");
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/70 px-2 py-1 shadow-2xs">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
            title={
              isCountdown
                ? `Contagem regressiva de ${Math.round((timer.countdownSecs ?? 0) / 60)} min`
                : "Cronômetro crescente (clique para escolher modo ou duração)"
            }
          >
            {isCountdown ? (
              <Hourglass
                className={`size-3.5 ${
                  timer.running ? "text-amber-500 animate-pulse" : "text-amber-500/80"
                }`}
              />
            ) : (
              <TimerIcon
                className={`size-3.5 ${
                  timer.running ? "text-emerald-500 animate-pulse" : "text-primary"
                }`}
              />
            )}
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                isZero ? "text-destructive font-black animate-pulse" : "text-foreground"
              }`}
            >
              {formattedTime}
            </span>
            <ChevronDown className="size-3 text-muted-foreground opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
            Duração do Palco (Timer / Countdown)
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {COUNTDOWN_PRESETS.map((p) => {
            const isCurrent =
              (p.secs === 0 && !isCountdown) ||
              (p.secs > 0 && timer.countdownSecs === p.secs);
            return (
              <DropdownMenuItem
                key={p.secs}
                className={`text-xs cursor-pointer flex items-center justify-between ${
                  isCurrent ? "font-semibold text-primary" : ""
                }`}
                onClick={() => handleSetCountdown(p.secs)}
              >
                <span>{p.label}</span>
                {isCurrent && <span className="size-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <div className="p-2">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowCustomInput(true);
                }}
                className="w-full text-left text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Personalizar minutos…
              </button>
            ) : (
              <form
                onSubmit={handleCustomSubmit}
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  min="0"
                  max="360"
                  placeholder="Minutos"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="h-7 w-20 rounded border border-input bg-background px-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs">
                  OK
                </Button>
              </form>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-3.5 w-px bg-border/60" />

      {/* Start / Pause */}
      <Button
        type="button"
        size="icon-xs"
        variant={timer.running ? "secondary" : "ghost"}
        className="size-6 text-foreground hover:text-primary cursor-pointer"
        onClick={() => void apply(timer.running ? timerPause() : timerStart())}
        title={timer.running ? "Pausar timer" : "Iniciar timer"}
        aria-label={timer.running ? "Pausar timer" : "Iniciar timer"}
      >
        {timer.running ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5 fill-current" />
        )}
      </Button>

      {/* Reset */}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => void apply(timerReset())}
        title="Zerar / Reiniciar timer"
        aria-label="Zerar timer"
      >
        <RotateCcw className="size-3" />
      </Button>
    </div>
  );
}
