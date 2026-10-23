import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Monitor,
  Music,
  Pencil,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { SlideTheme, ThemeAsset, ThemeContext } from "@/core/types";
import { exportThemeAsJson, importThemeFile } from "@/features/slide-themes/themeIo";
import {
  cloneTheme,
  isPublicTheme,
  previewTheme,
  PUBLIC_PAGE_CONTEXTS,
  themeCoverageLabel,
  themeVersion,
} from "@/features/slide-themes/pages";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_THEME,
  DEFAULT_STREAM_THEME,
} from "@/features/slide-themes/seedThemes";
import { openThemeEditor } from "@/core/ipc/commands";
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

/**
 * Galeria de temas. A aplicação do tema (por saída, evento ou ação ao vivo)
 * acontece no painel da saída e no evento — aqui só se cria/edita o documento.
 */
export function ThemesTab() {
  const themes = useSlideThemesStore((s) => s.themes);
  const load = useSlideThemesStore((s) => s.load);
  const save = useSlideThemesStore((s) => s.save);
  const remove = useSlideThemesStore((s) => s.remove);

  const [sampleAsset, setSampleAsset] = useState<ThemeAsset>("music");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SlideTheme | null>(null);
  const [renaming, setRenaming] = useState<SlideTheme | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  useEffect(() => {
    load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Falha ao carregar temas"),
    );
  }, [load]);

  const publicThemes = useMemo(() => themes.filter(isPublicTheme), [themes]);
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
      void openThemeEditor(theme.guid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema");
    }
  }

  async function handleCreateStage() {
    setError(null);
    try {
      const theme = newStageTheme(`Novo Tema de Retorno ${themes.length + 1}`);
      await save(theme);
      void openThemeEditor(theme.guid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema");
    }
  }

  async function handleCreateStream() {
    setError(null);
    try {
      const theme = cloneTheme(
        DEFAULT_STREAM_THEME,
        `Novo Tema de Transmissão ${themes.length + 1}`,
      );
      theme.category = "stream";
      await save(theme);
      void openThemeEditor(theme.guid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema de transmissão");
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
    void openThemeEditor(theme.guid);
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

  return (
    <div className="flex flex-col gap-7 select-none">
      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Galeria de temas
            </h3>
            <p className="text-xs text-muted-foreground">
              Crie, duplique ou edite temas para o telão, o palco e a transmissão. Para
              aplicar um tema, use a aba <span className="text-foreground">Camadas</span> da
              saída, o tema do evento ou o painel ao vivo.
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
                <DropdownMenuItem
                  onClick={() => void handleCreateStream()}
                  className="cursor-pointer gap-2"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Modelo de transmissão — Lower Third (OBS)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {galleryThemes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum tema encontrado. Crie um novo tema para começar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {galleryThemes.map((theme) => {
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
                    {theme.category === "stage" && (
                      <Badge variant="outline" className="text-[9px]">
                        Retorno
                      </Badge>
                    )}
                    {theme.category === "stream" && (
                      <Badge variant="outline" className="border-indigo-500/40 text-[9px] text-indigo-400">
                        Transmissão
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
