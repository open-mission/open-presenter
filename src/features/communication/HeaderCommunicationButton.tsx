import { Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import { useCommunicationStore } from "./store";

export function HeaderCommunicationButton() {
  const openDialog = useCommunicationStore((s) => s.openDialog);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const clearAlert = useCommunicationStore((s) => s.clearAlert);

  if (!activeAlert) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={openDialog}
        className="h-8 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        title="Enviar mensagem ou alerta para o retorno (Stage) · ⌘M"
      >
        <Megaphone className="size-3.5" />
        <span className="hidden xl:inline">Avisos</span>
        <kbd className="hidden 2xl:inline rounded bg-muted/80 px-1 py-0.2 font-mono text-[9px]">
          ⌘M
        </kbd>
      </Button>
    );
  }

  const { badgeColor, textColor } = (() => {
    switch (activeAlert.level) {
      case "urgent":
        return {
          badgeColor: "bg-red-500/20 border-red-500/60",
          textColor: "text-red-400",
        };
      case "warning":
        return {
          badgeColor: "bg-amber-500/20 border-amber-500/60",
          textColor: "text-amber-400",
        };
      case "info":
      default:
        return {
          badgeColor: "bg-sky-500/20 border-sky-500/60",
          textColor: "text-sky-400",
        };
    }
  })();

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-all shadow-xs",
        badgeColor,
      )}
    >
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-1.5 text-left cursor-pointer hover:opacity-90 max-w-[160px] md:max-w-[220px]"
        title={`Alerta ativo no retorno: "${activeAlert.text}" · Clique para gerenciar`}
      >
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
        <Megaphone className={cn("size-3.5 shrink-0", textColor)} />
        <span className={cn("truncate font-semibold", textColor)}>
          {activeAlert.text}
        </span>
      </button>

      <button
        type="button"
        onClick={() => void clearAlert()}
        className="size-4.5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 cursor-pointer ml-0.5"
        title="Limpar mensagem do retorno imediatamente"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
