import { CalendarDays, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import {
  themeCssVariables,
  type UiTheme,
  type UiThemeMode,
} from "@/core/theme/uiTheme";

interface ThemePreviewProps {
  theme: UiTheme;
  mode: UiThemeMode;
}

export function ThemePreview({ theme, mode }: ThemePreviewProps) {
  const style = {
    ...themeCssVariables(theme, mode),
    colorScheme: mode,
  } as unknown as React.CSSProperties;

  return (
    <section
      style={style}
      className={cn(
        "rounded-xl border border-border bg-background p-4 text-foreground",
        mode === "dark" && "dark",
      )}
      aria-label="Prévia da interface com o tema selecionado"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Prévia da interface</p>
          <p className="text-xs text-muted-foreground">
            Componentes reais usando os tokens selecionados.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Ao vivo
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Play className="size-3.5 fill-current" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Culto de domingo</p>
              <p className="truncate text-[10px] text-muted-foreground">
                Próximo slide · 2 de 12
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="pointer-events-none" tabIndex={-1}>
              Primária
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="pointer-events-none"
              tabIndex={-1}
            >
              Secundária
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="pointer-events-none"
              tabIndex={-1}
            >
              Outline
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="pointer-events-none"
              tabIndex={-1}
            >
              Destrutiva
            </Button>
          </div>
          <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Campo de exemplo
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
          Secundária
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          Suave
        </span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
          Destaque
        </span>
        <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] text-white">
          Destrutiva
        </span>
      </div>
    </section>
  );
}
