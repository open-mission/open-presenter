import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { formatClock, formatElapsed } from "@/core/lib/format";
import { Button } from "@/components/ui/button";

export function StageClock() {
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

  return (
    <div className="flex items-center gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-400">Hora</p>
        <p className="text-4xl font-bold tabular-nums">{formatClock(now)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-400">Cronômetro</p>
        <p className="text-4xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? "Pausar cronômetro" : "Iniciar cronômetro"}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
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
  );
}
