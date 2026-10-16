import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Copy, Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import type {
  OutputTarget,
  SlideKind,
  SlideTheme,
  ThemeAsset,
} from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeRenderer } from "@/features/slide-themes/ThemeRenderer";
import { SAMPLES } from "@/features/slide-themes/samples";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { isTauri } from "@/core/ipc/tauri";
import { openThemeEditor } from "@/core/ipc/commands";

interface BindingRow {
  target: OutputTarget;
  asset: SlideKind;
  label: string;
}

const BINDING_ROWS: BindingRow[] = [
  { target: "public", asset: "lyric", label: "Telão · Letra (música)" },
  { target: "public", asset: "scripture", label: "Telão · Bíblia" },
  { target: "public", asset: "custom", label: "Telão · Texto" },
];

function bindingLabel(target: OutputTarget, asset: SlideKind): string {
  return (
    BINDING_ROWS.find((r) => r.target === target && r.asset === asset)?.label ??
    `${target} · ${asset}`
  );
}

function newBlankTheme(title: string): SlideTheme {
  return {
    guid: crypto.randomUUID(),
    title,
    css: { background: "#000000" },
    elements: [
      {
        id: "letra",
        type: "TEXT",
        x: 10,
        y: 30,
        visible: true,
        locked: false,
        css: {
          top: "30%",
          left: "10%",
          width: "80%",
          textAlign: "center",
          fontSize: "56px",
          fontWeight: "700",
          lineHeight: "1.25",
          color: "#ffffff",
        },
        text: "{letra}",
      },
    ],
  };
}

export function ThemesTab() {
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
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

  useEffect(() => {
    load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Falha ao carregar temas"),
    );
  }, [load]);

  async function handleCreate() {
    setError(null);
    try {
      await save(newBlankTheme(`Novo tema ${themes.length + 1}`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema");
    }
  }

  async function handleDuplicate(theme: SlideTheme) {
    setError(null);
    try {
      await save({
        ...theme,
        guid: crypto.randomUUID(),
        title: `${theme.title} (cópia)`,
        elements: theme.elements.map((el) => ({ ...el, css: { ...el.css } })),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao duplicar tema");
    }
  }

  function handleEdit(theme: SlideTheme) {
    if (isTauri()) {
      void openThemeEditor(theme.guid);
    } else {
      window.open(`/#/theme-editor?guid=${theme.guid}`, "_blank");
    }
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

  const sample = SAMPLES[sampleAsset];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Temas de Slide
        </h3>
        <p className="text-sm text-muted-foreground">
          Galeria de temas do telão e do retorno de palco. Vincule um tema a
          cada tipo de conteúdo do telão e escolha o tema do retorno.
        </p>
      </div>

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      {/* Bindings */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-foreground">
          Vinculação por tipo (telão)
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BINDING_ROWS.map((row) => {
            const current = bindings.find(
              (b) => b.target === row.target && b.asset === row.asset,
            )?.themeGuid;
            return (
              <div key={`${row.target}:${row.asset}`} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {row.label}
                </span>
                <Select
                  value={current ?? "none"}
                  onValueChange={(value) =>
                    value === "none"
                      ? clearBinding(row.target, row.asset)
                      : setBinding(row.target, row.asset, value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um tema" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {themes.map((theme) => (
                      <SelectItem key={theme.guid} value={theme.guid}>
                        {theme.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Tema de retorno (palco)
          </span>
          <Select
            value={stageThemeGuid ?? "none"}
            onValueChange={(value) =>
              setStageTheme(value === "none" ? null : value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Padrão (sem tema)" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="none">Padrão (sem tema)</SelectItem>
              {themes.map((theme) => (
                <SelectItem key={theme.guid} value={theme.guid}>
                  {theme.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gallery header */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground">
          Galeria de temas
        </label>
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
          <Button size="sm" onClick={() => void handleCreate()}>
            <Plus className="size-3.5" />
            Novo tema
          </Button>
        </div>
      </div>

      {/* Gallery */}
      {themes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum tema encontrado. Crie um novo tema para começar.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {themes.map((theme) => {
            const usedBy = bindings
              .filter((b) => b.themeGuid === theme.guid)
              .map((b) => bindingLabel(b.target, b.asset));
            const isStage = stageThemeGuid === theme.guid;
            return (
              <div
                key={theme.guid}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3"
              >
                <div
                  className="relative h-44 w-full overflow-hidden rounded-lg border border-border"
                  style={theme.css as CSSProperties}
                >
                  <div className="absolute inset-0" style={{ zoom: 0.45 }}>
                    <ThemeRenderer
                      theme={theme}
                      asset={sampleAsset}
                      props={sample.props}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                    {theme.title}
                  </p>
                  {isStage && (
                    <Badge variant="outline" className="text-[9px]">
                      Retorno
                    </Badge>
                  )}
                </div>
                {usedBy.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {usedBy.map((label) => (
                      <Badge
                        key={label}
                        variant="default"
                        className="h-4 gap-1 px-1.5 text-[9px] font-semibold"
                      >
                        <Check className="size-2.5" />
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar ${theme.title}`}
                    onClick={() => handleEdit(theme)}
                  >
                    <PenLine className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Renomear ${theme.title}`}
                    onClick={() => {
                      setRenaming(theme);
                      setRenameTitle(theme.title);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Renomear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Duplicar ${theme.title}`}
                    onClick={() => void handleDuplicate(theme)}
                  >
                    <Copy className="size-3.5" />
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Excluir ${theme.title}`}
                    onClick={() => setConfirmDelete(theme)}
                  >
                    <Trash2 className="size-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Excluir tema</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Excluir “{confirmDelete?.title}”? As vinculações que usam este tema
            serão removidas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Renomear tema</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            placeholder="Título do tema"
            aria-label="Título do tema"
            onChange={(e) => setRenameTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button
              disabled={renameTitle.trim() === ""}
              onClick={() => void handleRename()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
