import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampPreviewLevel, type PreviewGridConfig } from "@/core/lib/previewGrid";
import { cn } from "@/core/lib/utils";

export function PreviewZoomControls({
  config,
  level,
  onChange,
  className,
}: {
  config: PreviewGridConfig;
  level: number;
  onChange: (level: number) => void;
  className?: string;
}) {
  const current = clampPreviewLevel(config, level);

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 cursor-pointer"
        title="Diminuir zoom (mais itens por linha)"
        disabled={current >= config.maxLevel}
        onClick={() => onChange(clampPreviewLevel(config, current + 1))}
      >
        <ZoomOut className="size-3.5" />
      </Button>
      <span className="w-3 text-center font-mono text-[10px] text-muted-foreground">
        {current}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 cursor-pointer"
        title="Aumentar zoom (menos itens por linha)"
        disabled={current <= config.minLevel}
        onClick={() => onChange(clampPreviewLevel(config, current - 1))}
      >
        <ZoomIn className="size-3.5" />
      </Button>
    </div>
  );
}
