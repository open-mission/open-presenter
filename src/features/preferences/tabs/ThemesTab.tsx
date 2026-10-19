import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Monitor,
  Music,
  Pencil,
  PenLine,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  SlideKind,
  SlideTheme,
  ThemeAsset,
  ThemeContext,
} from "@/core/types";
import { exportThemeAsJson, importThemeFile } from "@/features/slide-themes/themeIo";
import {
  cloneTheme,
  isPublicTheme,
  isStageCandidate,
  previewTheme,
  PUBLIC_PAGE_CONTEXTS,
  themeCoverageLabel,
  themeVersion,
} from "@/features/slide-themes/pages";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_THEME,
} from "@/features/slide-themes/seedThemes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import { useSlideThemesStore } from "@/features/slide-themes/store";

interface GridColumn {
  id: string;
  label: string;
  kind?: SlideKind;
  sampleAsset: ThemeAsset;
  sampleProps?: Record<string, string>;
}

const GRID_COLUMNS: GridColumn[] = [
  {
    id: "lyric",
    label: "Música",
    kind: "lyric",
    sampleAsset: "music",
    sampleProps: {
      letra: "CANTAI AO SENHOR\nUM CÂNTICO NOVO",
      titulo: "Salmo 96",
      secao: "Refrão",
    },
  },
  {
    id: "custom",
    label: "Texto",
    kind: "custom",
    sampleAsset: "text",
    sampleProps: {
      texto: "Culto de Domingo às 19h\nTodos são bem-vindos!",
      titulo: "Avisos Gerais",
    },
  },
  {
    id: "image",
    label: "Imagem",
    kind: undefined,
    sampleAsset: "text",
  },
  {
    id: "scripture",
    label: "Bíblia",
    kind: "scripture",
    sampleAsset: "bible",
    sampleProps: {
      verso: "Porque Deus amou o mundo de tal maneira...",
      titulo: "João 3:16",
    },
  },
  {
    id: "timer",
    label: "Timer",
    kind: undefined,
    sampleAsset: "text",
  },
  {
    id: "alert",
    label: "Aviso",
    kind: undefined,
    sampleAsset: "text",
  },
];

function newPublicTheme(
  title: string,
  focusContext?: ThemeContext,
): SlideTheme {
  const theme = cloneTheme(DEFAULT_PUBLIC_THEME, title);
  theme.category = "theme";
  if (focusContext && theme.pages) {
    const focused = theme.pages.find((page) => page.context === focusContext);
    if (focused) {
      theme.pages = [focused, ...theme.pages.filter((page) => page !== focused)];
    }
  }
  return theme;
}

function newStageTheme(title: string): SlideTheme {
  const theme = cloneTheme(DEFAULT_STAGE_THEME, title);
  theme.category = "stage";
  return theme;
}

const STAGE_RES_KEY = "open_presenter_stage_ref_res";

function loadStoredStageRes(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(STAGE_RES_KEY);
    if (!raw) return { width: 1280, height: 720 };
    const parsed = JSON.parse(raw);
    return {
      width: Number(parsed.width) || 1280,
      height: Number(parsed.height) || 720,
    };
  } catch {
    return { width: 1280, height: 720 };
  }
}

export function ThemesTab() {
  const navigate = useNavigate();
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
  const resolvedStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  const load = useSlideThemesStore((s) => s.load);
  const save = useSlideThemesStore((s) => s.save);
  const remove = useSlideThemesStore((s) => s.remove);
  const setBinding = useSlideThemesStore((s) => s.setBinding);
  const clearBinding = useSlideThemesStore((s) => s.clearBinding);
  const setStageTheme = useSlideThemesStore((s) => s.setStageTheme);

  const [sampleAsset, setSampleAsset] = useState<ThemeAsset>("music");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SlideTheme | null>(null);
  const [renaming, setRenaming] = useState<SlideTheme | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Reference resolution for stage
  const [stageRes, setStageRes] = useState<{ width: number; height: number }>(
    loadStoredStageRes,
  );

  function handleUpdateStageRes(width: number, height: number) {
    const res = { width, height };
    setStageRes(res);
    try {
      localStorage.setItem(STAGE_RES_KEY, JSON.stringify(res));
    } catch {}
  }

  // Target for theme picker modal
  const [pickerTarget, setPickerTarget] = useState<{
    type: "binding" | "stage";
    kind?: SlideKind;
    title: string;
  } | null>(null);

  useEffect(() => {
    load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Falha ao carregar temas"),
    );
  }, [load]);

  const publicThemes = useMemo(() => themes.filter(isPublicTheme), [themes]);
  const stageThemes = useMemo(() => themes.filter(isStageCandidate), [themes]);
  const galleryThemes = useMemo(
    () => themes.filter((theme) => theme.category !== "presentation"),
    [themes],
  );

  async function handleCreatePublic(context: ThemeContext) {
    setError(null);
    try {
      const info = PUBLIC_PAGE_CONTEXTS.find((item) => item.context === context)!;
      const theme = newPublicTheme(
        `Novo Tema de ${info.label} ${publicThemes.length + 1}`,
        context,
      );
      await save(theme);
      navigate(`/theme-editor?guid=${theme.guid}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema");
    }
  }

  async function handleCreateStage() {
    setError(null);
    try {
      const theme = newStageTheme(`Novo Tema de Retorno ${themes.length + 1}`);
      await save(theme);
      setStageTheme(theme.guid);
      navigate(`/theme-editor?guid=${theme.guid}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema");
    }
  }

  async function handleImportTheme() {
    setError(null);
    try {
      const imported = await importThemeFile();
      if (!imported) return;
      await save(imported);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao importar arquivo JSON de tema");
    }
  }

  async function handleDuplicate(theme: SlideTheme) {
    setError(null);
    try {
      await save(cloneTheme(theme));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao duplicar tema");
    }
  }

  function handleEdit(theme: SlideTheme) {
    navigate(`/theme-editor?guid=${theme.guid}`);
  }

  async function handleDelete() {
    if (confirmDelete === null) return;
    setError(null);
    try {
      await remove(confirmDelete.guid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao excluir tema");
    }
    setConfirmDelete(null);
  }

  async function handleRename() {
    if (renaming === null) return;
    const title = renameTitle.trim();
    if (title === "") return;
    setError(null);
    try {
      await save({ ...renaming, title });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao renomear tema");
    }
    setRenaming(null);
  }

  const pickerThemes =
    pickerTarget?.type === "stage" ? stageThemes : publicThemes;

  return (
    <div className="flex flex-col gap-7 select-none">
      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      {/* 1. SECTION: Temas Padrão (Diagramação em Grid) */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Temas padrão
          </h3>
          <p className="text-xs text-muted-foreground">
            Tema padrão por tipo de asset e saída. Passe o mouse para alterar ou editar.
          </p>
        </div>

        {/* Grid Table */}
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card/40 p-4 shadow-2xs">
          <div className="min-w-[760px]">
            {/* Table Header */}
            <div className="grid grid-cols-[100px_repeat(6,1fr)] items-center gap-3 border-b border-border/60 pb-3 text-xs font-semibold text-muted-foreground">
              <div>Saída</div>
              {GRID_COLUMNS.map((col) => (
                <div key={col.id} className="text-center">
                  {col.label}
                </div>
              ))}
            </div>

            {/* Table Row: Principal */}
            <div className="grid grid-cols-[100px_repeat(6,1fr)] items-center gap-3 pt-3">
              <div className="text-xs font-semibold text-foreground">
                Principal
              </div>

              {GRID_COLUMNS.map((col) => {
                const boundGuid = col.kind
                  ? bindings.find(
                      (b) => b.target === "public" && b.asset === col.kind,
                    )?.themeGuid
                  : undefined;
                const boundTheme = boundGuid
                  ? themes.find((t) => t.guid === boundGuid)
                  : undefined;

                if (boundTheme) {
                  const preview = previewTheme(boundTheme, col.sampleAsset);
                  return (
                    <div
                      key={col.id}
                      className="group relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black shadow-2xs transition-all hover:border-primary/50"
                    >
                      <div className="size-full pointer-events-none scale-100">
                        <ScaledStage
                          theme={preview.theme}
                          asset={preview.asset}
                          props={{
                            ...SAMPLES[preview.asset].props,
                            ...(col.sampleProps || {}),
                          }}
                        />
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-1.5">
                        <span className="text-[10px] font-semibold text-white truncate max-w-full text-center">
                          {boundTheme.title}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-6 px-1.5 text-[10px] cursor-pointer"
                            onClick={() =>
                              setPickerTarget({
                                type: "binding",
                                kind: col.kind,
                                title: col.label,
                              })
                            }
                          >
                            Alterar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[10px] cursor-pointer"
                            onClick={() => handleEdit(boundTheme)}
                          >
                            Editar
                          </Button>
                        </div>
                        {col.kind && (
                          <button
                            type="button"
                            onClick={() => clearBinding("public", col.kind!)}
                            className="text-[9px] text-muted-foreground hover:text-destructive underline cursor-pointer"
                          >
                            Desvincular
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      setPickerTarget({
                        type: "binding",
                        kind: col.kind,
                        title: col.label,
                      })
                    }
                    className="flex aspect-video w-full items-center justify-center rounded-lg border border-border/80 bg-card/60 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/50 hover:text-foreground cursor-pointer shadow-2xs"
                  >
                    <span>Nenhum</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECTION: Saída de Retorno (Stage) */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Saída de Retorno (Stage)
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Monitor de palco que mostra o conteúdo live da saída principal com tema próprio
            (estrofe atual, próxima, contador, relógio, timer). Atribua-a a uma saída simples
            em &quot;Simples&quot; e selecione &quot;Retorno (Stage)&quot; na coluna Virtual.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs space-y-4">
          {/* Top Row: Tema */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border/60">
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">
                Tema
              </span>
              <span className="text-sm font-semibold text-foreground">
                {resolvedStageTheme?.title ?? "Tema customizado"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {resolvedStageTheme && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs cursor-pointer"
                  onClick={() => handleEdit(resolvedStageTheme)}
                >
                  <Pencil className="size-3.5 mr-1" />
                  Editar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs cursor-pointer"
                onClick={() =>
                  setPickerTarget({
                    type: "stage",
                    title: "Retorno (Stage)",
                  })
                }
              >
                Alterar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive hover:text-destructive cursor-pointer"
                onClick={() => setStageTheme(null)}
              >
                Restaurar
              </Button>
            </div>
          </div>

          {/* Bottom Row: Resolução de referência */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Resolução de referência
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Usada pela prévia e pelo editor de tema do retorno. Não altera a projeção.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={stageRes.width}
                onChange={(e) =>
                  handleUpdateStageRes(
                    Number(e.target.value) || 1280,
                    stageRes.height,
                  )
                }
                className="h-8 w-20 text-center font-mono text-xs"
              />
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                value={stageRes.height}
                onChange={(e) =>
                  handleUpdateStageRes(
                    stageRes.width,
                    Number(e.target.value) || 720,
                  )
                }
                className="h-8 w-20 text-center font-mono text-xs"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 cursor-pointer shrink-0"
                title="Abrir tela de retorno em nova janela"
                onClick={() => window.open("/#/stage", "_blank")}
              >
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION: Galeria de temas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Galeria de temas
            </h3>
            <p className="text-xs text-muted-foreground">
              Crie, duplique ou edite temas para o telão e o palco. Novos temas
              já começam com um modelo visual completo; ajuste o que precisar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={sampleAsset}
              onValueChange={(value) => setSampleAsset(value as ThemeAsset)}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="Amostra" />
              </SelectTrigger>
              <SelectContent position="popper">
                {(Object.keys(SAMPLES) as ThemeAsset[]).map((asset) => (
                  <SelectItem key={asset} value={asset}>
                    {SAMPLES[asset].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 cursor-pointer"
              onClick={() => void handleImportTheme()}
              title="Importar tema a partir de arquivo JSON"
            >
              <Upload className="size-3.5" />
              <span>Importar JSON</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5 cursor-pointer">
                  <Plus className="size-3.5" />
                  <span>Novo tema</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => void handleCreatePublic("music")}
                  className="cursor-pointer gap-2"
                >
                  <Music className="size-3.5 text-primary" />
                  <span>Modelo público — Música</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleCreatePublic("bible")}
                  className="cursor-pointer gap-2"
                >
                  <BookOpen className="size-3.5 text-primary" />
                  <span>Modelo público — Bíblia</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleCreatePublic("text")}
                  className="cursor-pointer gap-2"
                >
                  <FileText className="size-3.5 text-primary" />
                  <span>Modelo público — Texto</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleCreateStage()}
                  className="cursor-pointer gap-2"
                >
                  <Monitor className="size-3.5 text-primary" />
                  <span>Modelo de palco — 4 momentos</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Gallery Grid */}
        {galleryThemes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum tema encontrado. Crie um novo tema para começar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {galleryThemes.map((theme) => {
              const isStage =
                stageThemeGuid === theme.guid ||
                resolvedStageTheme?.guid === theme.guid;
              const isDefaultPublic = bindings.some(
                (b) => b.themeGuid === theme.guid,
              );
              const preview = previewTheme(theme, sampleAsset);

              return (
                <div
                  key={theme.guid}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 shadow-2xs"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                    <ScaledStage
                      theme={preview.theme}
                      asset={preview.asset}
                      props={SAMPLES[preview.asset].props}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                      {theme.title}
                    </p>
                    {(isStage || theme.category === "stage") && (
                      <Badge variant="outline" className="text-[9px]">
                        Retorno
                      </Badge>
                    )}
                    {isDefaultPublic && (
                      <Badge variant="secondary" className="text-[9px]">
                        Telão
                      </Badge>
                    )}
                    {theme.pages?.length ? (
                      <Badge variant="outline" className="text-[9px]">
                        {themeCoverageLabel(theme)}
                      </Badge>
                    ) : null}
                    {themeVersion(theme) === "v1" && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-[9px] text-amber-500"
                      >
                        v1
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs"
                      onClick={() => handleEdit(theme)}
                    >
                      <Pencil className="size-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      onClick={() => void handleDuplicate(theme)}
                      title="Duplicar tema"
                    >
                      <Copy className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      onClick={() => exportThemeAsJson(theme)}
                      title="Exportar tema (JSON)"
                    >
                      <Download className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      onClick={() => {
                        setRenaming(theme);
                        setRenameTitle(theme.title);
                      }}
                      title="Renomear tema"
                    >
                      <PenLine className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(theme)}
                      title="Excluir tema"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Theme Picker */}
      <Dialog
        open={Boolean(pickerTarget)}
        onOpenChange={(open) => {
          if (!open) setPickerTarget(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Selecionar Tema · {pickerTarget?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3 max-h-[60vh] overflow-y-auto">
            {/* Option: Nenhum / Padrão */}
            <div
              onClick={() => {
                if (pickerTarget?.type === "stage") {
                  setStageTheme(null);
                } else if (pickerTarget?.kind) {
                  clearBinding("public", pickerTarget.kind);
                }
                setPickerTarget(null);
              }}
              className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 p-3 text-center transition-all hover:border-primary hover:bg-muted/40 cursor-pointer"
            >
              <span className="text-xs font-semibold text-foreground">
                Padrão / Nenhum
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Sem tema específico vinculado
              </span>
            </div>

            {/* List of Themes */}
            {pickerThemes.map((t) => {
              const preview = previewTheme(t, sampleAsset);
              return (
                <div
                  key={t.guid}
                  onClick={() => {
                    if (pickerTarget?.type === "stage") {
                      setStageTheme(t.guid);
                    } else if (pickerTarget?.kind) {
                      setBinding("public", pickerTarget.kind, t.guid);
                    }
                    setPickerTarget(null);
                  }}
                  className="group relative flex aspect-video flex-col justify-end overflow-hidden rounded-xl border border-border bg-black p-2.5 transition-all hover:border-primary hover:ring-2 hover:ring-primary/40 cursor-pointer shadow-2xs"
                >
                  <div className="size-full absolute inset-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    <ScaledStage
                      theme={preview.theme}
                      asset={preview.asset}
                      props={SAMPLES[preview.asset].props}
                    />
                  </div>
                  <div className="relative z-10 rounded bg-black/80 px-2 py-1 text-left backdrop-blur-xs">
                    <p className="truncate text-xs font-semibold text-white">
                      {t.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {themeCoverageLabel(t)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerTarget(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirm Delete */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir tema</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o tema &quot;{confirmDelete?.title}&quot;?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDelete()}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Rename Theme */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear tema</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Nome do tema"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenaming(null)}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void handleRename()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
