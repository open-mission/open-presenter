import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Circle,
  Clock,
  Download,
  FileJson,
  Film,
  Frame,
  Grid3x3,
  Image,
  Menu,
  Pencil,
  Redo,
  Ruler,
  Shapes,
  Sparkles,
  Square,
  Star,
  Triangle,
  Tv,
  Trash2,
  Type,
  Undo,
  Video,
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
import { generateNoiseDataUrl } from "@/features/slide-themes/noiseGenerator";
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
import { DEFAULT_STREAM_THEME_GUID } from "@/features/slide-themes/seedThemes";

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
  const addElements = useThemeEditorStore((s) => s.addElements);
  const removeSelection = useThemeEditorStore((s) => s.removeSelection);
  const duplicateSelection = useThemeEditorStore((s) => s.duplicateSelection);
  const groupSelection = useThemeEditorStore((s) => s.groupSelection);
  const ungroupSelection = useThemeEditorStore((s) => s.ungroupSelection);
  const selectAll = useThemeEditorStore((s) => s.selectAll);
  const upgradeToV2 = useThemeEditorStore((s) => s.upgradeToV2);
  const setCategory = useThemeEditorStore((s) => s.setCategory);

  const selection = useThemeEditorStore((s) => s.selection);
  const select = useThemeEditorStore((s) => s.select);
  const clearSelection = useThemeEditorStore((s) => s.clearSelection);
  const clearGuides = useThemeEditorStore((s) => s.clearGuides);
  const [sampleAsset, setSampleAsset] = useState<ThemeAsset>("music");
  const [snap, setSnap] = useState(true);
  const [showLimit, setShowLimit] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [gridSize, setGridSize] = useState(40);
  const [simulateCamera, setSimulateCamera] = useState(false);
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
        clearSelection();
        void load(payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [load, clearSelection]);

  useEffect(() => {
    clearSelection();
  }, [activePageId, clearSelection]);

  useEffect(() => {
    if (draft?.category === "stream" || draft?.guid === DEFAULT_STREAM_THEME_GUID) {
      setSimulateCamera(true);
    }
  }, [draft?.category, draft?.guid]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // On macOS/WebKit, pressing Backspace when no input is focused triggers history.back()
      // which closes/exits the view. We prevent default and delete the selected element.
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!isInput) {
          e.preventDefault();
          e.stopPropagation();
          removeSelection();
          return;
        }
      }

      if (e.key === "Escape" && !isInput) {
        e.preventDefault();
        clearSelection();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.repeat) return;
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
      } else if (key === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (key === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
      } else if (key === "a") {
        e.preventDefault();
        selectAll();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    removeSelection,
    undo,
    redo,
    clearSelection,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    selectAll,
  ]);

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

  function handleAdd(
    kind:
      | "text"
      | "color"
      | "circle"
      | "triangle"
      | "star"
      | "image"
      | "video"
      | "noise",
  ) {
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
          name: "Retângulo",
          type: "RECTANGLE",
          x: 760,
          y: 390,
          visible: true,
          locked: false,
          css: { ...baseCss(760, 390, 400, 300) },
          fill: "#1e3a8a",
        };
        break;
      case "circle":
        el = {
          id: uniqueId("circulo", ids),
          name: "Círculo",
          type: "CIRCLE",
          x: 810,
          y: 390,
          visible: true,
          locked: false,
          css: { ...baseCss(810, 390, 300, 300), borderRadius: "50%" },
          fill: "#4f46e5",
        };
        break;
      case "triangle":
        el = {
          id: uniqueId("triangulo", ids),
          name: "Triângulo",
          type: "TRIANGLE",
          x: 810,
          y: 390,
          visible: true,
          locked: false,
          css: {
            ...baseCss(810, 390, 300, 300),
            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
          },
          fill: "#f59e0b",
        };
        break;
      case "star":
        el = {
          id: uniqueId("estrela", ids),
          name: "Estrela",
          type: "STAR",
          x: 810,
          y: 390,
          visible: true,
          locked: false,
          css: {
            ...baseCss(810, 390, 300, 300),
            clipPath:
              "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
          },
          fill: "#eab308",
        };
        break;
      case "noise":
        el = {
          id: uniqueId("textura_noise", ids),
          name: "Textura de Ruído",
          type: "RECTANGLE",
          x: 0,
          y: 0,
          visible: true,
          locked: false,
          css: {
            ...baseCss(0, 0, 1920, 1080),
            opacity: "0.18",
            mixBlendMode: "overlay",
            pointerEvents: "none",
          },
          fill: generateNoiseDataUrl({ opacity: 0.25, grainSize: 1 }),
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
    select(el.id);
  }

  function handleAddSymbol(symbol: string) {
    if (!draft) return;
    const current = viewOf(
      draft,
      useThemeEditorStore.getState().activePageId,
    );
    if (selection.anchorId) {
      const el = current.elements.find((e) => e.id === selection.anchorId);
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
    select(newEl.id);
  }

  function handleAddWidget(
    widget: "clock" | "stopwatch" | "timer" | "next_verse" | "next_preview" | "lyrics" | "stage_message",
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
            textAlign: "center",
            fontSize: "44px",
            fontWeight: "700",
            color: "#fbbf24",
            blinkColon: "true",
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
      case "stage_message":
        el = {
          id: uniqueId("aviso_operador", ids),
          type: "TEXT",
          x: 120,
          y: 920,
          visible: true,
          locked: false,
          css: {
            ...baseCss(120, 920, 1680, 100),
            textAlign: "center",
            fontSize: "36px",
            fontWeight: "700",
            color: "#38bdf8",
            autoShrink: "true",
          },
          text: "{stage_message}",
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
    select(el.id);
  }

  function handleInsertLowerThird() {
    if (!draft) return;
    const current = viewOf(
      draft,
      useThemeEditorStore.getState().activePageId,
    );
    const ids = current.elements.map((e) => e.id);

    const boxId = uniqueId("lowerthird_fundo", ids);
    const boxEl: ThemeElement = {
      id: boxId,
      type: "RECTANGLE",
      x: 80,
      y: 860,
      visible: true,
      locked: false,
      css: {
        ...baseCss(80, 860, 1760, 160),
        backgroundColor: "rgba(15, 23, 42, 0.90)",
        borderRadius: "16px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
        borderLeft: "6px solid #38bdf8",
        backdropFilter: "blur(12px)",
      },
      fill: "rgba(15, 23, 42, 0.90)",
    };

    const textId = uniqueId("lowerthird_texto", [...ids, boxId]);
    const textEl: ThemeElement = {
      id: textId,
      type: "TEXT",
      x: 120,
      y: 875,
      visible: true,
      locked: false,
      css: {
        ...baseCss(120, 875, 1680, 130),
        textAlign: "left",
        fontSize: "44px",
        fontWeight: "600",
        lineHeight: "1.25",
        color: "#ffffff",
        textShadow: "0 2px 4px rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        autoShrink: "true",
      },
      text: "{lyrics}",
    };

    addElements([boxEl, textEl]);
    select(textId);
    setSimulateCamera(true);
    toast.success("Barra Lower Third adicionada!");
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
  const isStreamTheme =
    draft.category === "stream" ||
    draft.guid === DEFAULT_STREAM_THEME_GUID;
  const currentCategory: "theme" | "stage" | "stream" = isStageTheme
    ? "stage"
    : isStreamTheme
      ? "stream"
      : "theme";
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] cursor-pointer transition-colors select-none",
                      currentCategory === "stage" &&
                        "border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20",
                      currentCategory === "stream" &&
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
                      currentCategory === "theme" &&
                        "border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
                    )}
                    title="Destino do tema: clique para alternar entre Projeção, Retorno ou Transmissão"
                  >
                    {currentCategory === "stage"
                      ? "Retorno (Stage)"
                      : currentCategory === "stream"
                        ? "Transmissão (OBS)"
                        : "Projeção"}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() => {
                      setCategory("theme");
                      toast.success("Destinado para Projeção Pública");
                    }}
                  >
                    <span className="mr-2 size-2 rounded-full bg-purple-400" />
                    Projeção Pública
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setCategory("stage");
                      toast.success("Destinado para Retorno de Palco (Stage)");
                    }}
                  >
                    <span className="mr-2 size-2 rounded-full bg-sky-400" />
                    Retorno de Palco (Stage)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setCategory("stream");
                      setSimulateCamera(true);
                      toast.success("Destinado para Transmissão (OBS / Lower Third)");
                    }}
                  >
                    <span className="mr-2 size-2 rounded-full bg-emerald-400" />
                    Transmissão (OBS / Lower Third)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5" title="Adicionar formas geométricas">
              <Shapes className="size-3.5" />
              Formas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handleAdd("color")} className="gap-2 cursor-pointer">
              <Square className="size-3.5" />
              Retângulo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAdd("circle")} className="gap-2 cursor-pointer">
              <Circle className="size-3.5" />
              Círculo / Elipse
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAdd("triangle")} className="gap-2 cursor-pointer">
              <Triangle className="size-3.5" />
              Triângulo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAdd("star")} className="gap-2 cursor-pointer">
              <Star className="size-3.5" />
              Estrela
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAdd("noise")}
          title="Adiciona camada de textura de ruído/grão para o fundo"
          className="gap-1 text-amber-300 hover:text-amber-200"
        >
          <Sparkles className="size-3.5 text-amber-400" />
          Textura de Ruído
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
            <DropdownMenuItem onSelect={() => handleAddWidget("stage_message")}>
              Aviso do Operador ({`{stage_message}`})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleInsertLowerThird}
          title="Inserir barra estilizada de Lower Third (Tarja inferior para OBS)"
          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
        >
          <Tv className="size-3.5" />
          Lower Third
        </Button>

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
          variant={showRulers ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={showRulers}
          onClick={() => setShowRulers((v) => !v)}
          title="Exibir ou ocultar réguas de medição em pixels"
        >
          <Ruler className="size-3.5" />
          Réguas
        </Button>
        <Button
          variant={showGuides ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={showGuides}
          onClick={() => setShowGuides((v) => !v)}
          title="Exibir ou ocultar guias centrais e de segurança"
        >
          <Frame className="size-3.5" />
          Guias
        </Button>
        {(viewTheme.guides?.length ?? 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearGuides()}
            title="Remover todas as guias desta página"
          >
            <Trash2 className="size-3.5" />
            Limpar guias
          </Button>
        )}
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
        <Button
          variant={simulateCamera ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={simulateCamera}
          onClick={() => setSimulateCamera((v) => !v)}
          className={cn(
            "gap-1.5",
            simulateCamera &&
              "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-medium",
          )}
          title="Simular visualização sobre vídeo de câmera ao vivo (OBS / Transmissão)"
        >
          <Video className="size-3.5" />
          Simular OBS
        </Button>

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
          <LayersPanel />
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
              onChange={(el) =>
                useThemeEditorStore.getState().updateElement(el.id, el)
              }
              showGrid={showGrid}
              gridSize={gridSize}
              showLimit={showLimit}
              showRulers={showRulers}
              showGuides={showGuides}
              snap={snap}
              zoom={zoom}
              resolution={resolution}
              simulateCamera={simulateCamera}
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
          <PropertiesPanel />
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
