import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";

export interface ViewModeOption<T extends string> {
  value: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export function ViewModeToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ViewModeOption<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border/70 bg-muted/40 p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "secondary" : "ghost"}
            size="icon"
            onClick={() => onChange(option.value)}
            className="h-6 w-6 rounded-sm"
            title={option.label}
            aria-pressed={value === option.value}
          >
            <Icon className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
