import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Megaphone } from "lucide-react";
import type { CommunicationAlert } from "./types";
import { cn } from "@/core/lib/utils";

interface StageAlertOverlayProps {
  alert: CommunicationAlert;
  compact?: boolean;
}

export function StageAlertOverlay({
  alert,
  compact = false,
}: StageAlertOverlayProps) {
  const { cardBorder, badgeClasses, glowBg, icon } = useMemo(() => {
    switch (alert.level) {
      case "urgent":
        return {
          cardBorder: "border-red-500 shadow-2xl shadow-red-600/50",
          badgeClasses:
            "bg-red-600 text-white border-red-400 font-black animate-pulse",
          glowBg: "bg-red-950/90",
          icon: <AlertCircle className={compact ? "size-3.5" : "size-7 text-red-400"} />,
        };
      case "warning":
        return {
          cardBorder: "border-amber-500 shadow-2xl shadow-amber-600/40",
          badgeClasses:
            "bg-amber-500/30 text-amber-300 border-amber-400 font-bold",
          glowBg: "bg-amber-950/90",
          icon: <AlertTriangle className={compact ? "size-3.5" : "size-7 text-amber-400"} />,
        };
      case "info":
      default:
        return {
          cardBorder: "border-sky-500 shadow-2xl shadow-sky-600/40",
          badgeClasses:
            "bg-sky-500/30 text-sky-300 border-sky-400 font-bold",
          glowBg: "bg-slate-950/90",
          icon: <Megaphone className={compact ? "size-3.5" : "size-7 text-sky-400"} />,
        };
    }
  }, [alert.level, compact]);

  const levelLabel =
    alert.level === "urgent"
      ? "AVISO URGENTE DO OPERADOR"
      : alert.level === "warning"
      ? "ATENÇÃO · COMUNICAÇÃO"
      : "RECADO DO OPERADOR";

  const targetsLabel = useMemo(() => {
    if (!alert.targets || alert.targets.length === 0) return "Comunicação";
    const names: Record<string, string> = {
      stage: "Retorno",
      public: "Telão Público",
      stream: "Transmissão",
    };
    return alert.targets.map((t) => names[t] || t).join(" · ");
  }, [alert.targets]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-xl select-none animate-in fade-in zoom-in-95 duration-200"
    >
      <div
        className={cn(
          "flex max-w-4xl flex-col items-center justify-center rounded-2xl border-2 text-center text-white",
          compact ? "p-4 max-w-xs" : "p-8 md:p-14 w-full",
          glowBg,
          cardBorder,
        )}
      >
        {/* Header Badge */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border uppercase tracking-widest",
            compact ? "px-2 py-0.5 text-[10px] mb-2" : "px-4 py-1.5 text-xs md:text-sm mb-6",
            badgeClasses,
          )}
        >
          {icon}
          <span className="font-extrabold">{levelLabel}</span>
        </div>

        {/* Big Legible Message */}
        <p
          className={cn(
            "font-black tracking-tight leading-tight text-white drop-shadow-md break-words",
            compact
              ? "text-sm line-clamp-3"
              : "text-3xl sm:text-5xl md:text-6xl max-h-[60vh] overflow-hidden",
          )}
        >
          {alert.text}
        </p>

        {/* Sender / Target footer info */}
        {!compact && (
          <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground/80 font-mono">
            Canal: {targetsLabel} · {new Date(alert.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
