import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Grid3x3,
  Image,
  Film,
  Frame,
  Menu,
  Redo,
  Square,
  Type,
  Undo,
} from "lucide-react";
import type { ThemeAsset, ThemeElement } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SAMPLES } from "@/features/slide-themes/samples";
import { listenCommand } from "@/core/ipc/tauri";
import { Canvas } from "@/features/theme-editor/Canvas";
import { LayersPanel } from "@/features/theme-editor/LayersPanel";
import { PropertiesPanel } from "@/features/theme-editor/PropertiesPanel";
import { useThemeEditorStore } from "@/features/theme-editor/store";

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

export default function ThemeEditorView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const guid = searchParams.get("guid") ?? "";

  const draft = useThemeEditorStore((s) => s.draft);
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sampleAsset, setSampleAsset] = useState<ThemeAsset>("music");
  const [snap, setSnap] = useState(true);
  const [showLimit, setShowLimit] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(40);
  const [saving, setSaving] = useState(false);

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
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/preferences");
    }
  }

  function handleAdd(kind: "text" | "color" | "image" | "video") {
    if (!draft) return;
    const ids = draft.elements.map((el) => el.id);
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

  function handleAddWidget(
    widget: "hora" | "cronometro" | "timer" | "proximo" | "letra",
  ) {
    if (!draft) return;
    const ids = draft.elements.map((el) => el.id);
    let el: ThemeElement;
    switch (widget) {
      case "hora":
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
          text: "{hora}",
        };
        break;
      case "cronometro":
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
          text: "{cronometro}",
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
      case "proximo":
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
          text: "PRÓXIMO: {nextVerse}",
        };
        break;
      case "letra":
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
          text: "{letra}",
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
  const sample = SAMPLES[sampleAsset];
  const undoable = canUndo();
  const redoable = canRedo();

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon-sm" aria-label="Voltar" onClick={handleBack}>
          <ArrowLeft />
        </Button>
        <Input
          value={draft.title}
          aria-label="Título do tema"
          className="h-8 max-w-64 font-semibold"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Desfazer"
          disabled={!undoable}
          onClick={undo}
        >
          <Undo />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Refazer"
          disabled={!redoable}
          onClick={redo}
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
            <Button variant="ghost" size="icon-sm" aria-label="Menu do editor">
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!dirty} onSelect={() => revert()}>
              Reverter alterações
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleBack}>
              Fechar editor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Clock className="size-3.5" />
              Widgets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handleAddWidget("hora")}>
              Relógio ({`{hora}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("cronometro")}>
              Cronômetro ({`{cronometro}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("timer")}>
              Timer / Regressivo ({`{timer}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("letra")}>
              Slide Atual ({`{letra}`})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleAddWidget("proximo")}>
              Próximo Slide ({`{nextVerse}`})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant={snap ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={snap}
          onClick={() => setSnap((v) => !v)}
        >
          <Frame className="size-3.5" />
          Snap
        </Button>
        <Button
          variant={showLimit ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={showLimit}
          onClick={() => setShowLimit((v) => !v)}
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
            className="h-8 w-20"
            value={gridSize}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (Number.isFinite(num) && num > 0) setGridSize(Math.round(num));
            }}
          />
        )}
        <div className="flex-1" />
        <Select
          value={sampleAsset}
          onValueChange={(value) => setSampleAsset(value as ThemeAsset)}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Amostra de conteúdo">
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
      </div>

      {error !== null && (
        <p className="border-b border-border px-3 py-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-1 overflow-auto p-3">
          <p className="text-[11px] text-muted-foreground">
            Saída simulada · 1920×1080
          </p>
          <Canvas
            theme={draft}
            asset={sampleAsset}
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
          />
        </main>
        <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-3">
          <LayersPanel selectedId={selectedId} onSelect={setSelectedId} />
          <PropertiesPanel selectedId={selectedId} />
        </aside>
      </div>
    </div>
  );
}
