import { Megaphone, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { Button } from "@/components/ui/button";
import { useStageDisplayStore } from "./store";

const LEVEL_STYLES: Record<string, string> = {
  info: "border-sky-500 bg-sky-950",
  warning: "border-amber-500 bg-amber-950",
  urgent: "border-red-500 bg-red-950 animate-pulse",
};

export function StageAlerts() {
  const messages = useStageDisplayStore((s) => s.messages);
  const dismissMessage = useStageDisplayStore((s) => s.dismissMessage);

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3",
            LEVEL_STYLES[message.level] ?? LEVEL_STYLES.info,
          )}
        >
          <Megaphone size={18} className="shrink-0" />
          <p className="flex-1 text-lg font-semibold">{message.text}</p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => dismissMessage(message.id)}
            aria-label="Dispensar mensagem"
          >
            <X size={16} />
          </Button>
        </div>
      ))}
    </div>
  );
}
