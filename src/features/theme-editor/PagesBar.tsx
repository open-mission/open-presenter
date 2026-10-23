import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import {
  getActivePage,
  getPageForContext,
  materializePage,
  pageContextsForTheme,
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
  const addPresentationSlide = useThemeEditorStore((s) => s.addPresentationSlide);
  const duplicatePage = useThemeEditorStore((s) => s.duplicatePage);
  const movePage = useThemeEditorStore((s) => s.movePage);
  const renamePage = useThemeEditorStore((s) => s.renamePage);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!theme?.pages?.length) return null;

  const isPresentation = theme.category === "presentation";
  const contexts = isPresentation ? [] : pageContextsForTheme(theme);
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

  const handlePromptRename = (pageId: string, currentName: string) => {
    const nextName = window.prompt("Nome do slide:", currentName);
    if (nextName !== null && nextName.trim() !== "") {
      renamePage(pageId, nextName.trim());
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-card/40">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-semibold text-muted-foreground">
          {isPresentation
            ? `Slides da Apresentação (${theme.pages.length})`
            : "Páginas"}
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
        <div className="flex items-center gap-3 px-3 pb-2 overflow-x-auto">
          {isPresentation
            ? theme.pages.map((page, index) => {
                const isActive = page.id === current?.id;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => selectPage(page.id)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full bg-primary",
                        isActive && "ring-2 ring-primary/40",
                      )}
                    />
                    {page.name || `Slide ${index + 1}`}
                  </button>
                );
              })
            : contexts.map((info) => {
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
          {isPresentation ? (
            <>
              {theme.pages.map((page, index) => {
                const isActive = page.id === current?.id;
                const slideTitle = page.name || `Slide ${index + 1}`;
                return (
                  <div
                    key={page.id}
                    className={cn(
                      "group relative w-32 shrink-0 rounded-lg border p-1 transition-colors",
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background/60 hover:border-border/80",
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
                          asset="text"
                          props={SAMPLES.text.props}
                        />
                        <span className="absolute left-1 top-1 flex size-4 items-center justify-center rounded bg-black/70 text-[9px] font-bold text-white shadow">
                          {index + 1}
                        </span>
                      </span>
                      <span
                        className="truncate px-0.5 text-[11px] font-medium text-foreground cursor-pointer"
                        title="Clique duplo para renomear"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handlePromptRename(page.id, slideTitle);
                        }}
                      >
                        {slideTitle}
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Opções do ${slideTitle}`}
                          className="absolute right-1 top-1 size-5 bg-black/60 text-white opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => handlePromptRename(page.id, slideTitle)}
                        >
                          Renomear slide
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicatePage(page.id)}>
                          <Copy className="size-3.5 mr-1.5" />
                          Duplicar slide
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={index === 0}
                          onSelect={() => movePage(page.id, -1)}
                        >
                          <ArrowLeft className="size-3.5 mr-1.5" />
                          Mover para a esquerda
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={index === theme.pages!.length - 1}
                          onSelect={() => movePage(page.id, 1)}
                        >
                          <ArrowRight className="size-3.5 mr-1.5" />
                          Mover para a direita
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={theme.pages!.length <= 1}
                          onSelect={() => removePage(page.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-1.5" />
                          Remover slide
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

              {/* Botão Adicionar Slide */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Adicionar novo slide"
                    className="flex h-[86px] w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors"
                  >
                    <Plus className="size-4" />
                    <span className="text-[11px] font-medium">+ Novo Slide</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() => addPresentationSlide("duplicate")}
                  >
                    <Copy className="size-3.5 mr-1.5" />
                    Duplicar slide atual
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => addPresentationSlide("blank")}
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    Slide em branco
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            contexts.map((info) => {
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
            })
          )}
        </div>
      )}
    </div>
  );
}
