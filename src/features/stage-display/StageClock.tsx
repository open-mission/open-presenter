import { useEffect, useState } from "react";
import { formatElapsed } from "@/core/lib/format";
import { stageTimerElapsed } from "@/core/types";
import { useStageConfigStore } from "./configStore";
import { useStageTimerStore } from "./timerStore";

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
  const timer = useStageTimerStore((s) => s.timer);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

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
          <p className="text-4xl md:text-5xl font-bold tabular-nums">
            {formatElapsed(stageTimerElapsed(timer, now.getTime()))}
          </p>
        </div>
      )}
    </div>
  );
}
