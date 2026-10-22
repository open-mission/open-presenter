import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Megaphone } from "lucide-react";
import type { CommunicationAlert } from "./types";
import { cn } from "@/core/lib/utils";

interface StageAlertBannerProps {
  alert: CommunicationAlert;
  position: "top" | "bottom";
  compact?: boolean;
}

export function StageAlertBanner({
  alert,
  position,
  compact = false,
}: StageAlertBannerProps) {
  const isTop = position === "top";

  const { containerClasses, badgeClasses, icon } = useMemo(() => {
    switch (alert.level) {
      case "urgent":
        return {
          containerClasses:
            "bg-red-950/95 border-red-500 text-white shadow-2xl shadow-red-900/60",
          badgeClasses:
            "bg-red-600 text-white border-red-400 font-black animate-pulse",
          icon: <AlertCircle className={compact ? "size-3.5" : "size-5"} />,
        };
      case "warning":
        return {
          containerClasses:
            "bg-amber-950/95 border-amber-500 text-amber-50 shadow-2xl shadow-amber-900/60",
          badgeClasses:
            "bg-amber-500/25 text-amber-300 border-amber-400/50 font-bold",
          icon: <AlertTriangle className={compact ? "size-3.5" : "size-5"} />,
        };
      case "info":
      default:
        return {
          containerClasses:
            "bg-slate-950/95 border-sky-500 text-sky-50 shadow-2xl shadow-sky-950/80",
          badgeClasses:
            "bg-sky-500/25 text-sky-300 border-sky-400/50 font-bold",
          icon: <Megaphone className={compact ? "size-3.5" : "size-5"} />,
        };
    }
  }, [alert.level, compact]);

  // Duração da animação proporcional ao tamanho do texto (mínimo 12s)
  const durationSec = useMemo(() => {
    const chars = alert.text.length;
    return Math.max(12, Math.round(chars * 0.28));
  }, [alert.text]);

  const levelLabel =
    alert.level === "urgent"
      ? "URGENTE"
      : alert.level === "warning"
      ? "ATENÇÃO"
      : "AVISO";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-50 flex items-center overflow-hidden border-y select-none backdrop-blur-md",
        isTop ? "top-0 border-b-2" : "bottom-0 border-t-2",
        compact ? "h-9 px-3 text-xs" : "h-14 md:h-18 px-6 text-xl md:text-2xl",
        containerClasses,
      )}
    >
      <style>{`
        @keyframes op-stage-marquee-rtl {
          0% {
            transform: translateX(100vw);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .op-marquee-track {
          display: inline-block;
          white-space: nowrap;
          will-change: transform;
          animation: op-stage-marquee-rtl ${durationSec}s linear infinite;
        }
      `}</style>

      {/* Badge fixo de nível na esquerda para dar contexto imediato */}
      <div
        className={cn(
          "shrink-0 flex items-center gap-1.5 rounded-md border uppercase tracking-wider",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs md:text-sm mr-4",
          badgeClasses,
        )}
      >
        {icon}
        <span className="font-extrabold">{levelLabel}</span>
      </div>

      {/* Conteúdo: Letreiro Rolante da direita para a esquerda ou Texto Fixo */}
      {alert.scroll ? (
        <div className="relative flex-1 overflow-hidden">
          <div className="op-marquee-track font-bold tracking-wide drop-shadow-sm">
            {alert.text}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden text-center font-bold tracking-wide truncate drop-shadow-sm">
          {alert.text}
        </div>
      )}
    </div>
  );
}
