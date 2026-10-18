import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timerPause, timerReset, timerStart } from "@/core/ipc/commands";
import { formatElapsed } from "@/core/lib/format";
import { stageTimerElapsed } from "@/core/types";
import { useStageConfigStore } from "./configStore";
import { useStageTimerStore } from "./timerStore";

/**
 * Controles do cronômetro do palco para o painel do operador.
 * O estado vive no Rust (fonte da verdade); os botões aqui comandam,
 * e todas as saídas espelham o mesmo relógio via `stage://timer`.
 */
export function StageTimerControls() {
  const showTimer = useStageConfigStore((s) => s.showTimer);
  const timer = useStageTimerStore((s) => s.timer);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!showTimer) return null;

  async function apply(promise: Promise<import("@/core/types").StageTimer | null>) {
    const next = await promise;
    if (next) useStageTimerStore.getState().applyRemote(next);
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {formatElapsed(stageTimerElapsed(timer, now))}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() =>
            void apply(timer.running ? timerPause() : timerStart())
          }
          title={timer.running ? "Pausar cronômetro" : "Iniciar cronômetro"}
        >
          {timer.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {timer.running ? "Pausar" : "Iniciar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => void apply(timerReset())}
          title="Zerar cronômetro"
          aria-label="Zerar cronômetro"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
