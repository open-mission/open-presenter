import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { usePresentationStore } from "@/features/presentation/store";
import { themeBackgroundStyle } from "@/features/slide-themes/ThemeRenderer";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { formatElapsed } from "@/core/lib/format";
import { stageTimerElapsed } from "@/core/types";
import { useStageConfigStore } from "./configStore";
import { useStageTimerStore } from "./timerStore";

export function StageMiniPreview() {
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { theme, showClock, showNextUp, showTimer } = useStageConfigStore();
  const timer = useStageTimerStore((s) => s.timer);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.stage);
  const localStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  const stageTheme = broadcastTheme ?? localStageTheme;
  const backgroundStyle = stageTheme ? themeBackgroundStyle(stageTheme) : {};

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const time = new Date(now).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const themeStyles =
    theme === "high-contrast"
      ? "bg-black text-amber-300"
      : theme === "warm"
      ? "bg-stone-950 text-amber-100"
      : "bg-black text-white";

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between p-[3cqw] select-none overflow-hidden [container-type:inline-size] ${themeStyles}`}
      style={backgroundStyle}
    >
      {/* Top Header: Clock Centralizado */}
      <div className="flex items-center justify-center gap-[2cqw] border-b border-white/10 pb-[1.5cqw] text-[2.8cqw] opacity-75">
        {showClock && (
          <div className="flex items-center gap-[1cqw] font-mono font-semibold tabular-nums">
            <Clock className="size-[2.8cqw] opacity-60" />
            <span>{time}</span>
          </div>
        )}
        {showTimer && (
          <div className="flex items-center gap-[1cqw] font-mono font-semibold tabular-nums">
            <span className="text-[2cqw] opacity-60">CRONO</span>
            <span>{formatElapsed(stageTimerElapsed(timer, now))}</span>
          </div>
        )}
      </div>

      {/* Main Content: Current Live lyrics Centralizado */}
      <div className="my-auto flex flex-col items-center justify-center text-center px-[2cqw] py-[1cqw]">
        {live.blackout || live.cleared ? (
          <p className="text-[3.2cqw] font-semibold opacity-30 italic">
            {live.blackout ? "Blackout" : "—"}
          </p>
        ) : (
          <div className="space-y-[0.8cqw] flex flex-col items-center justify-center max-w-[95%]">
            {live.content.lines.slice(0, 4).map((line, idx) => (
              <p key={idx} className="leading-tight text-[4.2cqw] font-bold text-center">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Next Up Footer Centralizado */}
      {showNextUp && nextUp && (
        <div className="border-t border-white/10 pt-[1.5cqw] text-[2.2cqw] opacity-60 text-center flex flex-col items-center">
          <span className="font-semibold text-[2cqw] uppercase tracking-wider">
            Próximo · {nextUp.title}
          </span>
          <span className="truncate italic max-w-[90%]">
            {nextUp.lines[0] || ""}
          </span>
        </div>
      )}
    </div>
  );
}
