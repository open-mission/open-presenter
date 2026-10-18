import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Copy,
  Download,
  FolderPlus,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openThemeEditor } from "@/core/ipc/commands";
import type { SlideContent, SlideTheme } from "@/core/types";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import {
  DEFAULT_MUSIC_THEME_GUID,
  DEFAULT_STAGE_REST_THEME_GUID,
  DEFAULT_STAGE_THEME_GUID,
  DEFAULT_TEXT_THEME_GUID,
} from "@/features/slide-themes/seedThemes";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useSetlistStore } from "@/features/events-setlists/store";
import { usePresentationStore } from "@/features/presentation/store";
import { useNavigationStore } from "@/features/navigation/store";
import { exportThemeAsImage } from "@/features/theme-editor/exportImage";

const SYSTEM_GUIDS = new Set([
  DEFAULT_MUSIC_THEME_GUID,
  DEFAULT_TEXT_THEME_GUID,
  DEFAULT_STAGE_THEME_GUID,
  DEFAULT_STAGE_REST_THEME_GUID,
]);

const BG_PRESETS = [
  {
    id: "indigo",
    label: "Noite & Índigo",
    value: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
  },
  {
    id: "amber",
    label: "Ouro & Âmbar",
    value: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #1c1917 100%)",
  },
  {
    id: "emerald",
    label: "Esmeralda",
    value: "linear-gradient(135deg, #064e3b 0%, #022c22 60%, #000000 100%)",
  },
  {
    id: "rose",
    label: "Carmim & Vinho",
    value: "linear-gradient(135deg, #4c0519 0%, #881337 50%, #0f172a 100%)",
  },
  {
    id: "dark",
    label: "Minimalista Escuro",
    value: "#09090b",
  },
];

export function StudioPage() {
  const themes = useSlideThemesStore((s) => s.themes);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const duplicate = useSlideThemesStore((s) => s.duplicate);
  const createPresentation = useSlideThemesStore((s) => s.createPresentation);
  const removeTheme = useSlideThemesStore((s) => s.remove);

  // Setlist store
  const event = useSetlistStore((s) => s.event);
  const addMedia = useSetlistStore((s) => s.addMedia);
  const addPart = useSetlistStore((s) => s.addPart);
  const saveSetlist = useSetlistStore((s) => s.save);
  const setActiveTab = useNavigationStore((s) => s.setActiveTab);

  // Live state
  const live = usePresentationStore((s) => s.live);
  const publishLive = usePresentationStore((s) => s.publishLive);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"presentations" | "templates" | "all">(
    "presentations",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialogs
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedBg, setSelectedBg] = useState(BG_PRESETS[0].value);
  const [creating, setCreating] = useState(false);

  const [addToSetlistTheme, setAddToSetlistTheme] = useState<SlideTheme | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SlideTheme | null>(null);

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return themes.filter((t) => {
      const isSystem = SYSTEM_GUIDS.has(t.guid);
      const isPresentation = t.category === "presentation" || (!isSystem && t.category !== "theme");

      if (activeFilter === "presentations" && !isPresentation) return false;
      if (activeFilter === "templates" && isPresentation) return false;

      if (!q) return true;
      if (t.title.toLowerCase().includes(q)) return true;
      return t.elements.some((el) => (el.text ?? "").toLowerCase().includes(q));
    });
  }, [themes, search, activeFilter]);

  const counts = useMemo(() => {
    let presentations = 0;
    let templates = 0;
    for (const t of themes) {
      const isSystem = SYSTEM_GUIDS.has(t.guid);
      const isPresentation = t.category === "presentation" || (!isSystem && t.category !== "theme");
      if (isPresentation) presentations++;
      else templates++;
    }
    return { presentations, templates, all: themes.length };
  }, [themes]);

  async function handleCreateNew() {
    const title = newTitle.trim() || "Nova Apresentação";
    setCreating(true);
    try {
      const created = await createPresentation(title, selectedBg);
      setNewDialogOpen(false);
      setNewTitle("");
      toast.success(`Apresentação "${created.title}" criada!`);
      await openThemeEditor(created.guid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar apresentação.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(theme: SlideTheme) {
    try {
      const cloned = await duplicate(theme.guid);
      toast.success(`Apresentação duplicada como "${cloned.title}"!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao duplicar.");
    }
  }

  async function handleDelete(theme: SlideTheme) {
    try {
      await removeTheme(theme.guid);
      setDeleteCandidate(null);
      toast.success(`"${theme.title}" excluída.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  }

  async function handlePresentNow(theme: SlideTheme) {
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
      toast.success(`Apresentação "${theme.title}" agora está AO VIVO no telão!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao projetar.");
    }
  }

  async function handleAddThemeToPart(theme: SlideTheme, partId: string) {
    if (!event) return;
    try {
      addMedia(partId, {
        kind: "text",
        title: theme.title,
        text: "",
        themeId: theme.guid,
      });
      await saveSetlist();
      setAddToSetlistTheme(null);
      toast.success(`"${theme.title}" adicionada à programação!`, {
        action: {
          label: "Ver no Culto",
          onClick: () => setActiveTab("presentation"),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar à programação.");
    }
  }

  async function handleExportCardImage(theme: SlideTheme, format: "png" | "jpeg") {
    await exportThemeAsImage(theme, {
      fileName: `apresentacao-${theme.title}`,
      format,
      width: 1920,
      height: 1080,
      sampleProps: {
        title: theme.title,
        titulo: theme.title,
        lyrics: theme.title,
        letra: theme.title,
        text: theme.title,
        texto: theme.title,
      },
    });
  }

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 bg-background text-foreground select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/40 px-6 py-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                Studio de Criação
              </h1>
              <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                {counts.presentations} {counts.presentations === 1 ? "apresentação" : "apresentações"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie avisos, comunicados e slides visuais em alta resolução para o telão
            </p>
          </div>
        </div>

        {/* Action Controls: New Presentation, Search & Views */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar apresentações…"
              className="h-8.5 w-56 pl-8 pr-7 text-xs bg-background/80"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visualização em Lista"
            >
              <List className="size-4" />
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setNewTitle("");
              setNewDialogOpen(true);
            }}
            className="h-8.5 gap-1.5 px-3.5 text-xs font-semibold shadow-xs cursor-pointer bg-amber-600 hover:bg-amber-500 text-white"
          >
            <Plus className="size-4" />
            Nova Apresentação
          </Button>
        </div>
      </header>

      {/* Filter Tabs Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/80 px-6 py-2 bg-muted/15 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter("presentations")}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
              activeFilter === "presentations"
                ? "bg-accent font-semibold text-accent-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Apresentações & Avisos ({counts.presentations})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("templates")}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
              activeFilter === "templates"
                ? "bg-accent font-semibold text-accent-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Modelos de Sistema ({counts.templates})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
              activeFilter === "all"
                ? "bg-accent font-semibold text-accent-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({counts.all})
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground font-mono">
          {filteredItems.length} {filteredItems.length === 1 ? "item exibido" : "itens exibidos"}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 [scrollbar-gutter:stable]">
        {filteredItems.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {search ? "Nenhuma apresentação encontrada" : "Nenhuma apresentação criada ainda"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                {search
                  ? "Tente buscar por outro termo ou limpe o campo de busca."
                  : "Crie slides visuais com textos, cores, símbolos e fundos para avisos, versículos e momentos do culto."}
              </p>
            </div>
            {!search && (
              <Button
                type="button"
                size="sm"
                className="mt-2 gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
                onClick={() => setNewDialogOpen(true)}
              >
                <Plus className="size-4" />
                Criar Primeira Apresentação
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredItems.map((theme) => {
              const isLiveThis =
                live.content.media?.themeId === theme.guid &&
                !live.cleared &&
                !live.blackout &&
                live.content.kind !== "blank";

              return (
                <div
                  key={theme.guid}
                  className={`group relative flex flex-col rounded-xl border bg-card/60 overflow-hidden shadow-xs hover:shadow-md transition-all ${
                    isLiveThis
                      ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/10"
                      : "border-border/80 hover:border-amber-500/50"
                  }`}
                >
                  {/* Aspect 16:9 Slide Preview */}
                  <div
                    onDoubleClick={() => void handlePresentNow(theme)}
                    className="relative aspect-video w-full overflow-hidden bg-black cursor-pointer"
                    title="1 clique: ver detalhes · 2 cliques: apresentar ao vivo"
                  >
                    <ScaledStage
                      theme={theme}
                      asset="text"
                      props={{
                        title: theme.title,
                        titulo: theme.title,
                        lyrics: theme.title,
                        letra: theme.title,
                        text: theme.title,
                        texto: theme.title,
                      }}
                    />

                    {/* Status Badge */}
                    <div className="absolute left-2 top-2 z-20 pointer-events-none">
                      {isLiveThis && (
                        <Badge className="h-4 gap-1 bg-emerald-600 px-1.5 text-[9px] font-semibold text-white animate-pulse">
                          <Radio className="size-2.5" />
                          AO VIVO
                        </Badge>
                      )}
                    </div>

                    {/* Hover Overlay with Action Buttons */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openThemeEditor(theme.guid);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePresentNow(theme);
                        }}
                      >
                        <Play className="size-3.5 fill-current" />
                        Apresentar
                      </Button>
                    </div>
                  </div>

                  {/* Card Content Footer */}
                  <div className="flex items-center justify-between p-3 border-t border-border/60 bg-card/80">
                    <div className="min-w-0 flex-1 pr-2">
                      <p
                        className="truncate font-semibold text-xs text-foreground cursor-pointer hover:underline"
                        title={theme.title}
                        onClick={() => void openThemeEditor(theme.guid)}
                      >
                        {theme.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {theme.elements.length} {theme.elements.length === 1 ? "elemento" : "elementos"}
                        </span>
                        {theme.category && (
                          <span className="rounded bg-muted px-1 py-0.2 text-[9px] text-muted-foreground uppercase tracking-wide">
                            {theme.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3-Dots Action Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                          title="Mais opções"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 text-xs">
                        <DropdownMenuItem
                          onSelect={() => void openThemeEditor(theme.guid)}
                          className="cursor-pointer"
                        >
                          <Pencil className="size-3.5 mr-2 text-muted-foreground" />
                          Editar no Studio
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setAddToSetlistTheme(theme)}
                          className="cursor-pointer font-medium text-amber-500 focus:text-amber-500"
                        >
                          <CalendarPlus className="size-3.5 mr-2 text-amber-500" />
                          Adicionar à Programação
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void handlePresentNow(theme)}
                          className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                        >
                          <Play className="size-3.5 mr-2 fill-current" />
                          Apresentar ao Vivo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => void handleDuplicate(theme)}
                          className="cursor-pointer"
                        >
                          <Copy className="size-3.5 mr-2 text-muted-foreground" />
                          Duplicar Apresentação
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void handleExportCardImage(theme, "png")}
                          className="cursor-pointer"
                        >
                          <Download className="size-3.5 mr-2 text-muted-foreground" />
                          Exportar como PNG (1080p)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void handleExportCardImage(theme, "jpeg")}
                          className="cursor-pointer"
                        >
                          <Download className="size-3.5 mr-2 text-muted-foreground" />
                          Exportar como JPG (1080p)
                        </DropdownMenuItem>
                        {!SYSTEM_GUIDS.has(theme.guid) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setDeleteCandidate(theme)}
                              className="text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {filteredItems.map((theme) => {
              const isLiveThis =
                live.content.media?.themeId === theme.guid &&
                !live.cleared &&
                !live.blackout &&
                live.content.kind !== "blank";

              return (
                <div
                  key={theme.guid}
                  className={`flex items-center justify-between rounded-xl border p-3 bg-card/60 hover:bg-card transition-all ${
                    isLiveThis
                      ? "border-emerald-500 ring-2 ring-emerald-500/40"
                      : "border-border/80 hover:border-amber-500/50"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black border border-border/80 cursor-pointer"
                      onClick={() => void openThemeEditor(theme.guid)}
                    >
                      <ScaledStage
                        theme={theme}
                        asset="text"
                        props={{
                          title: theme.title,
                          titulo: theme.title,
                          lyrics: theme.title,
                          letra: theme.title,
                          text: theme.title,
                          texto: theme.title,
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-semibold text-xs text-foreground truncate cursor-pointer hover:underline"
                          onClick={() => void openThemeEditor(theme.guid)}
                        >
                          {theme.title}
                        </span>
                        {isLiveThis && (
                          <Badge className="h-4 gap-1 bg-emerald-600 px-1.5 text-[8px] font-semibold text-white">
                            AO VIVO
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {theme.elements.length} elementos · {theme.category || "Apresentação"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs cursor-pointer"
                      onClick={() => void openThemeEditor(theme.guid)}
                    >
                      <Pencil className="size-3" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                      onClick={() => setAddToSetlistTheme(theme)}
                    >
                      <CalendarPlus className="size-3" />
                      + Programação
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                      onClick={() => void handlePresentNow(theme)}
                    >
                      <Play className="size-3 fill-current" />
                      Apresentar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Nova Apresentação */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="size-4 text-amber-500" />
              Nova Apresentação (Studio)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dê um título e escolha um estilo inicial de plano de fundo para criar seu slide.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Título do Slide / Comunicado
              </label>
              <Input
                autoFocus
                placeholder="Ex.: Avisos de Domingo, Culto de Jovens, Dízimos..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateNew();
                }}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Estilo de Fundo Inicial
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BG_PRESETS.map((preset) => {
                  const isSelected = selectedBg === preset.value;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedBg(preset.value)}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 bg-accent/40"
                          : "border-border/80 hover:border-border"
                      }`}
                    >
                      <div
                        className="size-6 rounded shrink-0 border border-white/20 shadow-xs"
                        style={{ background: preset.value }}
                      />
                      <span className="text-xs font-medium truncate">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creating}
              onClick={() => void handleCreateNew()}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
            >
              {creating ? "Criando…" : "Criar e Abrir no Studio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar à Programação */}
      {addToSetlistTheme && (
        <Dialog
          open={Boolean(addToSetlistTheme)}
          onOpenChange={(open) => {
            if (!open) setAddToSetlistTheme(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <CalendarPlus className="size-4 text-amber-500" />
                Adicionar à Programação do Culto
              </DialogTitle>
              <DialogDescription className="text-xs">
                Selecione em qual parte ou seção você deseja inserir &quot;{addToSetlistTheme.title}&quot;:
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
                <span className="text-muted-foreground">Culto Ativo: </span>
                <span className="font-semibold text-foreground">
                  {event?.title || "Programação Geral"}
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(!event || event.parts.length === 0) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      addPart("Avisos & Comunicados");
                      setTimeout(() => {
                        const updated = useSetlistStore.getState().event;
                        const partId = updated?.parts[0]?.id;
                        if (partId) void handleAddThemeToPart(addToSetlistTheme, partId);
                      }, 50);
                    }}
                  >
                    <FolderPlus className="size-3.5 mr-2 text-primary" />
                    Criar Seção e Inserir Apresentação
                  </Button>
                ) : (
                  event.parts.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => void handleAddThemeToPart(addToSetlistTheme, part.id)}
                      className="flex w-full items-center justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary hover:bg-accent/40 text-left text-xs transition-colors cursor-pointer"
                    >
                      <span className="font-semibold truncate">
                        {part.title || "Seção Geral"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {part.items.length} {part.items.length === 1 ? "item" : "itens"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddToSetlistTheme(null)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Confirmar Exclusão */}
      {deleteCandidate && (
        <Dialog
          open={Boolean(deleteCandidate)}
          onOpenChange={(open) => {
            if (!open) setDeleteCandidate(null);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-destructive">
                Excluir Apresentação
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tem certeza que deseja excluir &quot;{deleteCandidate.title}&quot;? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteCandidate(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete(deleteCandidate)}
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
