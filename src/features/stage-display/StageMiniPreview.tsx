import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { usePresentationStore } from "@/features/presentation/store";
import { useStageConfigStore } from "./configStore";

export function StageMiniPreview() {
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { theme, showClock, showNextUp } = useStageConfigStore();

  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const themeStyles =
    theme === "high-contrast"
      ? "bg-black text-amber-300"
      : theme === "warm"
      ? "bg-stone-950 text-amber-100"
      : "bg-black text-white";

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between p-[3cqw] select-none overflow-hidden [container-type:inline-size] ${themeStyles}`}
    >
      {/* Top Header: Clock Centralizado */}
      <div className="flex items-center justify-center border-b border-white/10 pb-[1.5cqw] text-[2.8cqw] opacity-75">
        {showClock && (
          <div className="flex items-center gap-[1cqw] font-mono font-semibold tabular-nums">
            <Clock className="size-[2.8cqw] opacity-60" />
            <span>{time}</span>
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
