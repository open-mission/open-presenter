import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Download,
  FileJson,
  Grid3x3,
  Image,
  Film,
  Frame,
  Menu,
  Pencil,
  Redo,
  Square,
  Type,
  Undo,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { SlideTheme, ThemeAsset, ThemeContext, ThemeElement } from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportThemeAsImage } from "@/features/theme-editor/exportImage";
import { exportThemeAsJson } from "@/features/slide-themes/themeIo";
import {
  contextToAsset,
  getActivePage,
  materializePage,
  pageContextsForCategory,
  themeVersion,
} from "@/features/slide-themes/pages";
import { cn } from "@/core/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SAMPLES } from "@/features/slide-themes/samples";
import { listenCommand } from "@/core/ipc/tauri";
import {
  Canvas,
  RESOLUTION_PRESETS,
  type CanvasResolution,
} from "@/features/theme-editor/Canvas";
import { LayersPanel } from "@/features/theme-editor/LayersPanel";
import { PagesBar } from "@/features/theme-editor/PagesBar";
import { PropertiesPanel } from "@/features/theme-editor/PropertiesPanel";
import { SymbolsPicker } from "@/features/theme-editor/SymbolsPicker";
import { useThemeEditorStore } from "@/features/theme-editor/store";
import { useSlideThemesStore } from "@/features/slide-themes/store";

function uniqueId(prefix: string, existing: string[]): string {
  let n = existing.length + 1;
  let id = `${prefix}-${n}`;
  while (existing.includes(id)) {
    n += 1;
    id = `${prefix}-${n}`;
  }
  return id;
}

function baseCss(left: number, top: number, width: number, height: number) {
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
}

function viewOf(theme: SlideTheme, activePageId: string | null): SlideTheme {
  const page = getActivePage(theme, activePageId);
  return page ? materializePage(theme, page) : theme;
}

export default function ThemeEditorView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const guid = searchParams.get("guid") ?? "";

  const draft = useThemeEditorStore((s) => s.draft);
  const activePageId = useThemeEditorStore((s) => s.activePageId);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
  const resolvedStageThemeGuid = useSlideThemesStore(
    (s) => s.resolveStageTheme()?.guid ?? null,
  );
  const error = useThemeEditorStore((s) => s.error);
  const load = useThemeEditorStore((s) => s.load);
  const setTitle = useThemeEditorStore((s) => s.setTitle);
  const undo = useThemeEditorStore((s) => s.undo);
  const redo = useThemeEditorStore((s) => s.redo);
  const canUndo = useThemeEditorStore((s) => s.canUndo);
  const canRedo = useThemeEditorStore((s) => s.canRedo);
  const isDirty = useThemeEditorStore((s) => s.isDirty);
  const save = useThemeEditorStore((s) => s.save);
  const revert = useThemeEditorStore((s) => s.revert);
  const addElement = useThemeEditorStore((s) => s.addElement);
  const upgradeToV2 = useThemeEditorStore((s) => s.upgradeToV2);
  const setCategory = useThemeEditorStore((s) => s.setCategory);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sampleAsset, setSampleAsset] = useState<ThemeAsset>("music");
  const [snap, setSnap] = useState(true);
  const [showLimit, setShowLimit] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(40);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Photoshop-like 3-column & Canvas zoom/resolution states
  const [layersWidth, setLayersWidth] = useState(260);
  const isDraggingLayersDivider = useRef(false);
  const [propertiesWidth, setPropertiesWidth] = useState(360);
  const isDraggingDivider = useRef(false);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [resolution, setResolution] = useState<CanvasResolution>(
    RESOLUTION_PRESETS[0],
  );

  // Rename theme dialog
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<ThemeContext>("music");

  useEffect(() => {
    if (guid) void load(guid);
  }, [guid, load]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listenCommand<string | null>("theme-editor://open", (payload) => {
      if (typeof payload === "string" && payload !== "") {
        setSelectedId(null);
        void load(payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [load]);

  useEffect(() => {
    setSelectedId(null);
  }, [activePageId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function handleSave() {
    setSaving(true);
    try {
      await save();
      toast.success("Tema salvo com sucesso!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar tema.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format: "png" | "jpeg") {
    if (!draft) {
      toast.error("Nenhum tema carregado para exportação.");
      return;
    }
    setExporting(true);
    try {
      const exportTheme = viewOf(
        draft,
        useThemeEditorStore.getState().activePageId,
      );
      const page = getActivePage(
        draft,
        useThemeEditorStore.getState().activePageId,
      );
      const exportAsset = page ? contextToAsset(page.context) : sampleAsset;
      await exportThemeAsImage(exportTheme, {
        fileName: draft.title ? `apresentacao-${draft.title}` : "apresentacao",
        format,
        width: resolution.width,
        height: resolution.height,
        sampleProps: SAMPLES[exportAsset]?.props ?? {},
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar imagem.");
    } finally {
      setExporting(false);
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/preferences");
    }
  }

  function handleLayersDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingLayersDivider.current = true;
    const startX = e.clientX;
    const startW = layersWidth;

    function onMouseMove(ev: MouseEvent) {
      if (!isDraggingLayersDivider.current) return;
      const delta = ev.clientX - startX;
      const newWidth = Math.min(550, Math.max(180, startW + delta));
      setLayersWidth(newWidth);
    }

    function onMouseUp() {
      isDraggingLayersDivider.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingDivider.current = true;
    const startX = e.clientX;
    const startW = propertiesWidth;

    function onMouseMove(ev: MouseEvent) {
      if (!isDraggingDivider.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(650, Math.max(320, startW + delta));
      setPropertiesWidth(newWidth);
    }

    function onMouseUp() {
      isDraggingDivider.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleAdd(kind: "text" | "color" | "image" | "video") {
    if (!draft) return;
    const current = viewOf(
      draft,
      useThemeEditorStore.getState().activePageId,
    );
    const ids = current.elements.map((el) => el.id);
    let el: ThemeElement;
    switch (kind) {
      case "text":
        el = {
          id: uniqueId("texto", ids),
          type: "TEXT",
          x: 480,
          y: 440,
          visible: true,
          locked: false,
          css: {
            ...baseCss(480, 440, 960, 200),
            textAlign: "center",
            fontSize: "64px",
            fontWeight: "700",
            lineHeight: "1.25",
            color: "#ffffff",
          },
          text: "Novo texto",
        };
        break;
      case "color":
        el = {
          id: uniqueId("retangulo", ids),
          type: "RECTANGLE",
          x: 760,
          y: 390,
          visible: true,
          locked: false,
          css: { ...baseCss(760, 390, 400, 300) },
          fill: "#1e3a8a",
        };
        break;
      case "image":
        el = {
          id: uniqueId("imagem", ids),
          type: "IMAGE",
          x: 800,
          y: 390,
          visible: true,
          locked: false,
          css: { ...baseCss(800, 390, 320, 300) },
          src: "",
        };
        break;
      case "video":
        el = {
          id: uniqueId("video", ids),
          type: "VIDEO",
          x: 0,
          y: 0,
          visible: true,
          locked: false,
          css: { ...baseCss(0, 0, 1920, 1080) },
          src: "",
        };
        break;
    }
    addElement(el);
    setSelectedId(el.id);
  }

  function handleAddSymbol(symbol: string) {
    if (!draft) return;
    const current = viewOf(
      draft,
      useThemeEditorStore.getState().activePageId,
    );
    if (selectedId) {
      const el = current.elements.find((e) => e.id === selectedId);
      if (el && el.type === "TEXT") {
        useThemeEditorStore.getState().updateElement(el.id, {
          ...el,
          text: (el.text ?? "") ? `${el.text} ${symbol}` : symbol,
        });
        return;
      }
    }
    const ids = current.elements.map((el) => el.id);
    const newEl: ThemeElement = {
      id: uniqueId("simbolo", ids),
      type: "TEXT",
      x: 880,
      y: 460,
      visible: true,
      locked: false,
      css: {
        ...baseCss(880, 460, 160, 160),
        fontSize: "64px",
        textAlign: "center",
        color: "#ffffff",
      },
      text: symbol,
    };
    addElement(newEl);
    setSelectedId(newEl.id);
  }

  function handleAddWidget(
    widget: "clock" | "stopwatch" | "timer" | "next_verse" | "next_preview" | "lyrics",
  ) {
    if (!draft) return;
    const current = viewOf(
      draft,
      useThemeEditorStore.getState().activePageId,
    );
    const ids = current.elements.map((el) => el.id);
    let el: ThemeElement;
    switch (widget) {
      case "clock":
        el = {
          id: uniqueId("relogio", ids),
          type: "TEXT",
          x: 60,
          y: 40,
          visible: true,
          locked: false,
          css: {
            ...baseCss(60, 40, 360, 70),
            textAlign: "left",
            fontSize: "44px",
            fontWeight: "700",
            color: "#fbbf24",
          },
          text: "{clock}",
        };
        break;
      case "stopwatch":
        el = {
          id: uniqueId("cronometro", ids),
          type: "TEXT",
          x: 1500,
          y: 40,
          visible: true,
          locked: false,
          css: {
            ...baseCss(1500, 40, 360, 70),
            textAlign: "right",
            fontSize: "44px",
            fontWeight: "700",
            color: "#38bdf8",
          },
          text: "{stopwatch}",
        };
        break;
      case "timer":
        el = {
          id: uniqueId("timer", ids),
          type: "TEXT",
          x: 1500,
          y: 120,
          visible: true,
          locked: false,
          css: {
            ...baseCss(1500, 120, 360, 70),
            textAlign: "right",
            fontSize: "44px",
            fontWeight: "700",
            color: "#f87171",
          },
          text: "{timer}",
        };
        break;
      case "next_verse":
        el = {
          id: uniqueId("proximo", ids),
          type: "TEXT",
          x: 120,
          y: 840,
          visible: true,
          locked: false,
          css: {
            ...baseCss(120, 840, 1680, 180),
            textAlign: "center",
            fontSize: "32px",
            fontWeight: "500",
            lineHeight: "1.3",
            color: "#94a3b8",
            borderTopWidth: "1px",
            borderTopColor: "rgba(255,255,255,0.15)",
            borderTopStyle: "solid",
            paddingTop: "16px",
            autoShrink: "true",
          },
          text: "PRÓXIMO: {next_verse}",
        };
        break;
      case "next_preview":
        el = {
          id: uniqueId("proximo_resumo", ids),
          type: "TEXT",
          x: 120,
          y: 860,
          visible: true,
          locked: false,
          css: {
            ...baseCss(120, 860, 1680, 140),
            textAlign: "center",
            fontSize: "30px",
            fontWeight: "500",
            lineHeight: "1.3",
            color: "#94a3b8",
            borderTopWidth: "1px",
            borderTopColor: "rgba(255,255,255,0.15)",
            borderTopStyle: "solid",
            paddingTop: "14px",
            autoShrink: "true",
          },
          text: "Próximo: {next_preview}",
        };
        break;
      case "lyrics":
        el = {
          id: uniqueId("letra", ids),
          type: "TEXT",
          x: 120,
          y: 200,
          visible: true,
          locked: false,
          css: {
            ...baseCss(120, 200, 1680, 580),
            textAlign: "center",
            fontSize: "64px",
            fontWeight: "700",
            lineHeight: "1.25",
            color: "#ffffff",
            autoShrink: "true",
          },
          text: "{lyrics}",
        };
        break;
    }
    addElement(el);
    setSelectedId(el.id);
  }

  if (!guid || (!draft && error)) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <h1 className="text-lg font-semibold">Editor de Temas</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {!guid
            ? "Nenhum tema selecionado. Abra o editor a partir da galeria de temas."
            : (error ?? "Tema não encontrado.")}
        </p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
        <h1 className="text-lg font-semibold">Editor de Temas</h1>
        <p className="text-sm text-muted-foreground">Carregando tema…</p>
      </div>
    );
  }

  const dirty = isDirty();
  const isStageTheme =
    draft.category === "stage" ||
    draft.guid === stageThemeGuid ||
    draft.guid === resolvedStageThemeGuid;
  const contexts = pageContextsForCategory(isStageTheme ? "stage" : "theme");
  const upgradeable = draft.category !== "presentation" && !draft.pages?.length;
  const currentPage = getActivePage(draft, activePageId);
  const viewTheme = currentPage ? materializePage(draft, currentPage) : draft;
  const activeAsset = currentPage
    ? contextToAsset(currentPage.context)
    : sampleAsset;
  const sample = SAMPLES[activeAsset];
  const undoable = canUndo();
  const redoable = canRedo();

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 bg-card/40">
        <Button variant="ghost" size="icon-sm" aria-label="Voltar" onClick={handleBack}>
          <ArrowLeft />
        </Button>

        {/* Theme Title with Edit Pencil button */}
        <div className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-accent/50 group transition-colors">
          <span className="font-semibold text-sm max-w-64 truncate" title={draft.title}>
            {draft.title || "Sem título"}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
            onClick={() => {
              setRenameValue(draft.title);
              setIsRenameOpen(true);
            }}
            title="Renomear tema"
            aria-label="Renomear tema"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>

        {(() => {
          const version = themeVersion(draft);
          const label =
            version === "v2" ? "v2" : version === "v1" ? "v1" : "Layout único";
          return (
            <>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  version === "v2" &&
                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
                  version === "v1" &&
                    "border-amber-500/40 bg-amber-500/10 text-amber-500",
                )}
              >
                {label}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] cursor-pointer transition-colors",
                  isStageTheme
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
                    : "border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
                )}
                onClick={() => {
                  const nextCategory = isStageTheme ? "theme" : "stage";
                  setCategory(nextCategory);
                  toast.success(
                    nextCategory === "stage"
                      ? "Destinado para Retorno de Palco (Stage)"
                      : "Destinado para Projeção Pública",
                  );
                }}
                title="Clique para alternar destino entre Projeção e Retorno de Palco"
              >
                {isStageTheme ? "Retorno (Stage)" : "Projeção"}
              </Badge>
              {upgradeable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUpgradeContext(isStageTheme ? "rest" : "music");
                    setUpgradeOpen(true);
                  }}
                >
                  {isStageTheme ? "Adicionar páginas" : "Atualizar para v2"}
                </Button>
              )}
            </>
          );
        })()}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Desfazer"
          disabled={!undoable}
          onClick={undo}
          title="Desfazer (Ctrl+Z / Cmd+Z)"
        >
          <Undo />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Refazer"
          disabled={!redoable}
          onClick={redo}
          title="Refazer (Ctrl+Y / Cmd+Y)"
        >
          <Redo />
        </Button>
        <span
          className="text-xs text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          {saving ? "Salvando…" : dirty ? "Não salvo" : "Salvo"}
        </span>
        <Button size="sm" disabled={!dirty || saving} onClick={() => void handleSave()}>
          Salvar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={exporting}
              title="Exportar imagem do slide em alta resolução"
            >
              <Download className="size-3.5" />
              <span>{exporting ? "Exportando…" : "Exportar"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void handleExport("png")}>
              <Download className="mr-2 size-4 text-primary" />
              Exportar como PNG ({resolution.width}×{resolution.height})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleExport("jpeg")}>
              <Download className="mr-2 size-4 text-primary" />
              Exportar como JPG ({resolution.width}×{resolution.height})
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (draft) {
                  exportThemeAsJson(draft);
                  toast.success("Tema exportado como JSON com sucesso!");
                }
              }}
            >
              <FileJson className="mr-2 size-4 text-primary" />
              Exportar Tema (JSON)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Menu do editor">
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void handleExport("png")}>
              <Download className="mr-2 size-4" />
              Exportar PNG ({resolution.width}×{resolution.height})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleExport("jpeg")}>
              <Download className="mr-2 size-4" />
              Exportar JPG ({resolution.width}×{resolution.height})
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (draft) {
                  exportThemeAsJson(draft);
                  toast.success("Tema exportado como JSON com sucesso!");
                }
              }}
            >
              <FileJson className="mr-2 size-4" />
              Exportar Tema (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!dirty} onSelect={() => revert()}>
              Reverter alterações
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleBack}>
              Fechar editor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Sub-header Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 bg-card/20 flex-wrap">
        <span className="mr-1 text-[11px] font-semibold text-muted-foreground">
          Adicionar:
        </span>
        <Button variant="ghost" size="sm" onClick={() => handleAdd("text")}>
          <Type className="size-3.5" />
          Texto
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAdd("color")}>
          <Square className="size-3.5" />
          Cor
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAdd("image")}>
          <Image className="size-3.5" />
          Imagem
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAdd("video")}>
          <Film className="size-3.5" />
          Vídeo
        </Button>

        <SymbolsPicker onInsert={handleAddSymbol} title="Adicionar Símbolo / Ícone" />

        {/* Widgets with Canonical English tokens */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Clock className="size-3.5" />
              Widgets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handleAddWidget("clock")}>
              Relógio ({`{clock}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("stopwatch")}>
              Cronômetro ({`{stopwatch}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("timer")}>
              Timer / Regressivo ({`{timer}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("lyrics")}>
              Slide Atual ({`{lyrics}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("next_verse")}>
              Próximo Slide ({`{next_verse}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("next_preview")}>
              Próximo (Início com ...) ({`{next_preview}`})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          variant={snap ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={snap}
          onClick={() => setSnap((v) => !v)}
          title="Snap inteligente nas margens e guias"
        >
          <Frame className="size-3.5" />
          Snap
        </Button>
        <Button
          variant={showLimit ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={showLimit}
          onClick={() => setShowLimit((v) => !v)}
          title="Margem de segurança (90%)"
        >
          Limite
        </Button>
        <Button
          variant={showGrid ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={showGrid}
          onClick={() => setShowGrid((v) => !v)}
        >
          <Grid3x3 className="size-3.5" />
          Grid
        </Button>
        {showGrid && (
          <Input
            type="number"
            min={4}
            aria-label="Tamanho do grid em pixels"
            className="h-8 w-18 text-xs"
            value={gridSize}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (Number.isFinite(num) && num > 0) setGridSize(Math.round(num));
            }}
          />
        )}

        <div className="flex-1" />

        {draft.pages?.length ? (
          <span className="mr-1 text-xs text-muted-foreground">
            Página:{" "}
            {contexts.find((info) => info.context === currentPage?.context)
              ?.label ?? "—"}
          </span>
        ) : (
          <>
            <span className="text-xs text-muted-foreground mr-1">Amostra:</span>
            <Select
              value={sampleAsset}
              onValueChange={(value) => setSampleAsset(value as ThemeAsset)}
            >
              <SelectTrigger size="sm" className="w-32 h-8 text-xs" aria-label="Amostra de conteúdo">
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
          </>
        )}
      </div>

      {error !== null && (
        <p className="border-b border-border px-3 py-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* 3-Column Photoshop Layout: Layers (Left) | Canvas (Center) | Divider | Properties (Right) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Layers Panel */}
        <aside
          style={{ width: `${layersWidth}px`, minWidth: "180px" }}
          className="shrink-0 flex flex-col h-full overflow-y-auto border-r border-border p-3 bg-card/20"
        >
          <LayersPanel selectedId={selectedId} onSelect={setSelectedId} />
        </aside>

        {/* Resizable Divider Handle for Layers */}
        <div
          role="separator"
          tabIndex={0}
          aria-label="Redimensionar painel de camadas"
          onMouseDown={handleLayersDividerMouseDown}
          className="relative w-1.5 shrink-0 cursor-col-resize select-none bg-border/40 hover:bg-primary/50 transition-colors after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:z-10"
        />

        {/* Center Column: Canvas Preview Area */}
        <main className="flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-background">
          {/* Canvas Sub-Bar: Resolution & Zoom controls */}
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                {resolution.width}×{resolution.height}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <Select
                value={`${resolution.width}x${resolution.height}`}
                onValueChange={(val) => {
                  const found = RESOLUTION_PRESETS.find(
                    (p) => `${p.width}x${p.height}` === val,
                  );
                  if (found) setResolution(found);
                }}
              >
                <SelectTrigger size="sm" className="h-7 text-xs w-48">
                  <SelectValue placeholder="Resolução" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_PRESETS.map((preset) => (
                    <SelectItem
                      key={`${preset.width}x${preset.height}`}
                      value={`${preset.width}x${preset.height}`}
                    >
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-xs"
                title="Reduzir Zoom"
                onClick={() => {
                  if (zoom === "fit") setZoom(0.75);
                  else if (zoom === 1.5) setZoom(1.25);
                  else if (zoom === 1.25) setZoom(1.0);
                  else if (zoom === 1.0) setZoom(0.75);
                  else if (zoom === 0.75) setZoom(0.5);
                }}
              >
                <ZoomOut className="size-3.5" />
              </Button>

              <Select
                value={String(zoom)}
                onValueChange={(val) => {
                  if (val === "fit") setZoom("fit");
                  else setZoom(Number(val));
                }}
              >
                <SelectTrigger size="sm" className="h-7 w-24 text-xs font-mono">
                  <SelectValue placeholder="Zoom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Ajustar (Fit)</SelectItem>
                  <SelectItem value="0.5">50%</SelectItem>
                  <SelectItem value="0.75">75%</SelectItem>
                  <SelectItem value="1">100%</SelectItem>
                  <SelectItem value="1.25">125%</SelectItem>
                  <SelectItem value="1.5">150%</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon-xs"
                title="Aumentar Zoom"
                onClick={() => {
                  if (zoom === "fit") setZoom(1.0);
                  else if (zoom === 0.5) setZoom(0.75);
                  else if (zoom === 0.75) setZoom(1.0);
                  else if (zoom === 1.0) setZoom(1.25);
                  else if (zoom === 1.25) setZoom(1.5);
                }}
              >
                <ZoomIn className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Canvas Element */}
          <div className="flex-1 min-h-0 min-w-0 p-3 flex flex-col">
            <Canvas
              theme={viewTheme}
              asset={activeAsset}
              props={sample.props}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={(el) =>
                useThemeEditorStore.getState().updateElement(el.id, el)
              }
              showGrid={showGrid}
              gridSize={gridSize}
              showLimit={showLimit}
              snap={snap}
              zoom={zoom}
              resolution={resolution}
            />
          </div>
          <PagesBar />
        </main>

        {/* Resizable Divider Handle */}
        <div
          role="separator"
          tabIndex={0}
          aria-label="Redimensionar painel de propriedades"
          onMouseDown={handleDividerMouseDown}
          className="relative w-1.5 shrink-0 cursor-col-resize select-none bg-border/40 hover:bg-primary/50 transition-colors after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:z-10"
        />

        {/* Right Column: Properties & Formatting Panel */}
        <aside
          style={{ width: `${propertiesWidth}px`, minWidth: "320px" }}
          className="shrink-0 flex flex-col h-full overflow-y-auto border-l border-border p-3 bg-card/20"
        >
          <PropertiesPanel selectedId={selectedId} />
        </aside>
      </div>

      {/* Upgrade Theme Dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isStageTheme
                ? "Adicionar páginas ao tema de palco"
                : "Atualizar tema para v2"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 text-xs text-muted-foreground">
            <p>
              O layout atual será movido para a página do contexto escolhido. O visual
              não muda e você poderá adicionar as outras páginas depois.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Contexto da página
              </label>
              <Select
                value={upgradeContext}
                onValueChange={(value) => setUpgradeContext(value as ThemeContext)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contexts.map((info) => (
                    <SelectItem key={info.context} value={info.context}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                upgradeToV2(
                  upgradeContext,
                  isStageTheme ? "stage" : "theme",
                );
                setUpgradeOpen(false);
                toast.success("Tema atualizado para páginas. Salve para aplicar.");
              }}
            >
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Theme Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Tema</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Nome do Tema
            </label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Ex: Padrão Culto, Palco Músicos..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = renameValue.trim();
                  if (trimmed) setTitle(trimmed);
                  setIsRenameOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const trimmed = renameValue.trim();
                if (trimmed) setTitle(trimmed);
                setIsRenameOpen(false);
              }}
            >
              Salvar Nome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
