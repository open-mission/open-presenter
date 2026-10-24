import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Copy,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Presentation,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openThemeEditor } from "@/core/ipc/commands";
import type { SlideContent, SlideTheme } from "@/core/types";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { usePresentationStore } from "@/features/presentation/store";
import { useSetlistStore } from "@/features/events-setlists/store";
import { ThemePreview } from "@/features/studio/ThemePreview";
import { setAssetDragData } from "../dnd";

export function MediaPresentationsBrowser() {
  const themes = useSlideThemesStore((s) => s.themes);
  const duplicate = useSlideThemesStore((s) => s.duplicate);
  const removeTheme = useSlideThemesStore((s) => s.remove);
  const createPresentation = useSlideThemesStore((s) => s.createPresentation);

  const live = usePresentationStore((s) => s.live);
  const publishLive = usePresentationStore((s) => s.publishLive);

  const event = useSetlistStore((s) => s.event);
  const addMedia = useSetlistStore((s) => s.addMedia);
  const saveSetlist = useSetlistStore((s) => s.save);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const presentations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return themes.filter((t) => {
      // Filter presentations: explicitly tagged as presentation or having multiple pages without being pure system default
      const isPres = t.category === "presentation" || (t.pages && t.pages.length > 0 && t.category !== "bible" && t.category !== "lowerthird");
      if (!isPres) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q);
    });
  }, [themes, search]);

  const handlePresentLive = async (theme: SlideTheme) => {
    const slideContent: SlideContent = {
      id: `studio-${theme.guid}`,
      kind: "custom",
      title: theme.title,
      lines: [],
      media: {
        kind: "text",
        title: theme.title,
        text: "",
        themeId: theme.guid,
      },
    };
    try {
      await publishLive(slideContent, null);
      toast.success(`Apresentação "${theme.title}" agora está AO VIVO!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao projetar apresentação.");
    }
  };

  const handleCreate = async () => {
    try {
      const created = await createPresentation("Nova Apresentação");
      toast.success(`Apresentação "${created.title}" criada!`);
      void openThemeEditor(created.guid);
    } catch {
      toast.error("Falha ao criar apresentação.");
    }
  };

  const handleDuplicate = async (theme: SlideTheme) => {
    try {
      const cloned = await duplicate(theme.guid);
      toast.success(`Apresentação duplicada como "${cloned.title}"!`);
    } catch {
      toast.error("Falha ao duplicar.");
    }
  };

  const handleDelete = async (theme: SlideTheme) => {
    if (!confirm(`Tem certeza que deseja excluir a apresentação "${theme.title}"?`)) return;
    try {
      await removeTheme(theme.guid);
      toast.success(`"${theme.title}" excluída.`);
    } catch {
      toast.error("Falha ao excluir.");
    }
  };

  const handleAddToSetlist = async (theme: SlideTheme) => {
    if (!event) {
      toast.error("Nenhum evento ativo na programação.");
      return;
    }
    const partId = event.parts[0]?.id;
    if (!partId) {
      toast.error("O evento precisa de ao menos uma parte.");
      return;
    }
    try {
      addMedia(partId, {
        kind: "text",
        title: theme.title,
        text: "",
        themeId: theme.guid,
      });
      await saveSetlist();
      toast.success(`"${theme.title}" adicionada à programação.`);
    } catch {
      toast.error("Falha ao adicionar à programação.");
    }
  };

  return (
    <div className="flex h-full flex-col gap-2.5">
      {/* Top Search & Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar apresentações…"
            className="h-7 w-full pl-8 pr-7 text-xs bg-muted/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex size-6 items-center justify-center rounded cursor-pointer ${
              viewMode === "grid" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
            }`}
            title="Visualização em grade"
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex size-6 items-center justify-center rounded cursor-pointer ${
              viewMode === "list" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
            }`}
            title="Visualização em lista"
          >
            <List className="size-3.5" />
          </button>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          className="h-7 gap-1 px-2.5 text-xs font-semibold cursor-pointer shadow-xs"
        >
          <Plus className="size-3.5" />
          <span>Criar</span>
        </Button>
      </div>

      {/* Presentations List / Grid */}
      {presentations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <Presentation className="size-8 text-muted-foreground/40" />
          <p className="text-xs font-medium text-muted-foreground">
            {search ? "Nenhuma apresentação encontrada." : "Nenhuma apresentação criada ainda."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreate}
            className="h-7 text-xs cursor-pointer"
          >
            Criar primeira apresentação
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
          {presentations.map((theme) => {
            const isLive = live?.content.id === `studio-${theme.guid}` || live?.content.media?.themeId === theme.guid;
            return (
              <div
                key={theme.guid}
                draggable
                onDragStart={(e) => setAssetDragData(e, { type: "theme", themeGuid: theme.guid })}
                onDoubleClick={() => void handlePresentLive(theme)}
                className={`group relative flex flex-col overflow-hidden rounded-lg border bg-card/60 p-1.5 transition-all select-none cursor-pointer hover:border-primary/50 ${
                  isLive ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border"
                }`}
                title="Dois cliques para apresentar ao vivo"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
                  <ThemePreview
                    theme={theme}
                    asset="text"
                    title={theme.title}
                  />
                  {isLive && (
                    <div className="absolute top-1 right-1 rounded bg-emerald-500 px-1 py-0.5 text-[9px] font-bold text-black uppercase tracking-wider shadow">
                      Ao Vivo
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePresentLive(theme);
                      }}
                      className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform shadow cursor-pointer"
                      title="Apresentar ao vivo"
                    >
                      <Play className="size-3.5 fill-current ml-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openThemeEditor(theme.guid);
                      }}
                      className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:scale-105 transition-transform shadow cursor-pointer"
                      title="Editar no Studio"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between px-0.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">
                      {theme.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {theme.pages?.length ?? 1} {(theme.pages?.length ?? 1) === 1 ? "slide" : "slides"}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => void handlePresentLive(theme)}>
                        <Play className="mr-2 size-3.5" />
                        <span>Apresentar agora</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openThemeEditor(theme.guid)}>
                        <Pencil className="mr-2 size-3.5" />
                        <span>Editar no Studio</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleAddToSetlist(theme)}>
                        <CalendarPlus className="mr-2 size-3.5" />
                        <span>+ Programação</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleDuplicate(theme)}>
                        <Copy className="mr-2 size-3.5" />
                        <span>Duplicar</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => void handleDelete(theme)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        <span>Excluir</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-card/40 overflow-hidden">
          {presentations.map((theme) => {
            const isLive = live?.content.id === `studio-${theme.guid}` || live?.content.media?.themeId === theme.guid;
            return (
              <div
                key={theme.guid}
                draggable
                onDragStart={(e) => setAssetDragData(e, { type: "theme", themeGuid: theme.guid })}
                onDoubleClick={() => void handlePresentLive(theme)}
                className={`flex items-center justify-between p-2 hover:bg-muted/40 transition-colors select-none cursor-pointer ${
                  isLive ? "bg-emerald-500/10" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative aspect-video w-14 shrink-0 overflow-hidden rounded bg-black">
                    <ThemePreview
                      theme={theme}
                      asset="text"
                      title={theme.title}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {theme.title}
                      </span>
                      {isLive && (
                        <span className="rounded bg-emerald-500/20 text-emerald-400 px-1 py-0.2 text-[9px] font-bold uppercase">
                          Ao Vivo
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {theme.pages?.length ?? 1} {(theme.pages?.length ?? 1) === 1 ? "slide" : "slides"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePresentLive(theme);
                    }}
                    className="size-7 text-muted-foreground hover:text-emerald-400 cursor-pointer"
                    title="Apresentar ao vivo"
                  >
                    <Play className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openThemeEditor(theme.guid);
                    }}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Editar no Studio"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleAddToSetlist(theme);
                    }}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="+ Programação"
                  >
                    <CalendarPlus className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
