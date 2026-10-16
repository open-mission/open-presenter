import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { formatElapsed } from "@/core/lib/format";
import { Button } from "@/components/ui/button";
import { useStageConfigStore } from "./configStore";

function formatCustomClock(date: Date, is24h: boolean, showSeconds: boolean): string {
  return date.toLocaleTimeString("pt-BR", {
    hour12: !is24h,
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });
}

export function StageClock() {
  const { showClock, clock24h, showSeconds, showTimer } = useStageConfigStore();
  const [now, setNow] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (!showClock && !showTimer) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 text-center mx-auto">
      {showClock && (
        <div className="flex flex-col items-center">
          <p className="text-xs uppercase tracking-widest text-zinc-400">Hora</p>
          <p className="text-4xl md:text-5xl font-bold tabular-nums">
            {formatCustomClock(now, clock24h, showSeconds)}
          </p>
        </div>
      )}
      {showTimer && (
        <div className="flex flex-col items-center">
          <p className="text-xs uppercase tracking-widest text-zinc-400">Cronômetro</p>
          <div className="flex items-center gap-3">
            <p className="text-4xl md:text-5xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
            <div className="flex gap-1.5">
              <Button
                size="icon"
                variant="secondary"
                className="size-8"
                onClick={() => setRunning((r) => !r)}
                aria-label={running ? "Pausar cronômetro" : "Iniciar cronômetro"}
              >
                {running ? <Pause size={16} /> : <Play size={16} />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => {
                  setRunning(false);
                  setElapsed(0);
                }}
                aria-label="Zerar cronômetro"
              >
                <RotateCcw size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
