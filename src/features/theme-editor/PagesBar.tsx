import { useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import {
  getActivePage,
  getPageForContext,
  materializePage,
  PAGE_CONTEXTS,
} from "@/features/slide-themes/pages";
import { cn } from "@/core/lib/utils";
import { useThemeEditorStore } from "./store";

const COLLAPSE_KEY = "open_presenter_theme_pages_collapsed";

export function PagesBar() {
  const theme = useThemeEditorStore((s) => s.draft);
  const activePageId = useThemeEditorStore((s) => s.activePageId);
  const selectPage = useThemeEditorStore((s) => s.selectPage);
  const addPage = useThemeEditorStore((s) => s.addPage);
  const removePage = useThemeEditorStore((s) => s.removePage);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!theme?.pages?.length) return null;

  const current = getActivePage(theme, activePageId);
  const toggle = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  return (
    <div className="shrink-0 border-t border-border bg-card/40">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Páginas
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={collapsed ? "Expandir páginas" : "Recolher páginas"}
          onClick={toggle}
        >
          {collapsed ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>

      {collapsed ? (
        <div className="flex items-center gap-3 px-3 pb-2">
          {PAGE_CONTEXTS.map((info) => {
            const page = getPageForContext(theme, info.context);
            return (
              <span
                key={info.context}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    page ? "bg-primary" : "border border-muted-foreground/50",
                    page?.id === current?.id && "ring-2 ring-primary/40",
                  )}
                />
                {info.label}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {PAGE_CONTEXTS.map((info) => {
            const page = getPageForContext(theme, info.context);
            if (!page) {
              return (
                <DropdownMenu key={info.context}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Criar página de ${info.label}`}
                      className="flex h-[86px] w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    >
                      <Plus className="size-4" />
                      <span className="text-[11px]">{info.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      disabled={!current}
                      onSelect={() => addPage(info.context, "duplicate")}
                    >
                      Duplicar página atual
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addPage(info.context, "blank")}>
                      Página em branco
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            const isActive = page.id === current?.id;
            return (
              <div
                key={info.context}
                className={cn(
                  "group relative w-32 shrink-0 rounded-lg border p-1",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background/60",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 text-left"
                  onClick={() => selectPage(page.id)}
                >
                  <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-black">
                    <ScaledStage
                      theme={materializePage(theme, page)}
                      asset={info.asset}
                      props={SAMPLES[info.asset].props}
                    />
                  </span>
                  <span className="truncate px-0.5 text-[11px] font-medium text-foreground">
                    {info.label}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Opções da página ${info.label}`}
                      className="absolute right-1 top-1 size-5 bg-black/60 text-white opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={theme.pages!.length <= 1}
                      onSelect={() => removePage(page.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Remover página
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
