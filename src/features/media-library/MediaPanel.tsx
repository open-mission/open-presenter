import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Film,
  GripVertical,
  Image as ImageIcon,
  Images as ImagesIcon,
  Layers,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Presentation,
  ScanLine,
  Search,
  Sparkles,
  Volume2,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SlideTheme } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { openThemeEditor } from "@/core/ipc/commands";
import { Button } from "@/components/ui/button";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useDisplaysStore } from "@/features/displays/store";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
import { useSetlistStore } from "@/features/events-setlists/store";
import { usePresentationStore } from "@/features/presentation/store";
import { previewTheme } from "@/features/slide-themes/pages";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import {
  ISF_PRESETS,
  getISFThumbnail,
  isIsfBackground,
} from "@/features/media-shaders/isfEngine";
import { ISFShaderDialog } from "@/features/media-shaders/ISFShaderDialog";
import { useMediaShadersStore, type CustomISFShader } from "@/features/media-shaders/store";
import { useBackgroundAssets } from "./assets";
import {
  applyBackgroundToOutput,
  applyThemeToOutput,
  clearOverrideForOutput,
  preferredCategoryForTheme,
  resolveApplyTarget,
} from "./applyAsset";
import { clearAssetDragData, setAssetDragData } from "./dnd";
import type { BackgroundAsset } from "./types";
import { useMediaFolderLibrary } from "./useMediaFolderLibrary";
import { MediaFolderBrowser } from "./components/MediaFolderBrowser";
import { MediaSongsBrowser } from "./components/MediaSongsBrowser";
import { MediaPresentationsBrowser } from "./components/MediaPresentationsBrowser";
import { MediaStudioBrowser } from "./components/MediaStudioBrowser";
import { BiblePage } from "@/features/bible/BiblePage";
import { useMediaPlaybackStore } from "@/core/store/mediaPlaybackStore";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { MediaPanelTab } from "@/core/lib/panelLayout";

export type PanelTab = MediaPanelTab;

interface TabMeta {
  id: PanelTab;
  label: string;
  icon: LucideIcon;
}

const TAB_DEFINITIONS: Record<PanelTab, TabMeta> = {
  presentations: { id: "presentations", label: "Apresentações", icon: Presentation },
  studio: { id: "studio", label: "Studio", icon: Wand2 },
  bible: { id: "bible", label: "Bíblia", icon: BookOpen },
  themes: { id: "themes", label: "Temas", icon: Layers },
  backgrounds: { id: "backgrounds", label: "Fundos", icon: ImageIcon },
  lower: { id: "lower", label: "Lowerthirds", icon: ScanLine },
  shaders: { id: "shaders", label: "Shaders", icon: Sparkles },
  songs: { id: "songs", label: "Músicas", icon: Music },
  images: { id: "images", label: "Imagens", icon: ImagesIcon },
  videos: { id: "videos", label: "Vídeos", icon: Film },
  audios: { id: "audios", label: "Áudios", icon: Volume2 },
};

const DEFAULT_TAB_ORDER: PanelTab[] = [
  "presentations",
  "studio",
  "bible",
  "themes",
  "backgrounds",
  "lower",
  "shaders",
  "songs",
  "images",
  "videos",
  "audios",
];

const STORAGE_TAB_ORDER_KEY = "open_presenter_media_panel_tab_order";

function loadSavedTabOrder(): PanelTab[] {
  try {
    const raw = localStorage.getItem(STORAGE_TAB_ORDER_KEY);
    if (!raw) return DEFAULT_TAB_ORDER;
    const parsed = JSON.parse(raw) as PanelTab[];
    const valid = parsed.filter((id) => id in TAB_DEFINITIONS);
    for (const d of DEFAULT_TAB_ORDER) {
      if (!valid.includes(d)) valid.push(d);
    }
    return valid;
  } catch {
    return DEFAULT_TAB_ORDER;
  }
}

function ISFThumb({ source, alt }: { source: string; alt: string }) {
  const [thumb, setThumb] = useState<string | null>(() => getISFThumbnail(source));

  useEffect(() => {
    if (!thumb) {
      const res = getISFThumbnail(source);
      if (res) setThumb(res);
    }
  }, [source, thumb]);

  if (thumb) {
    return (
      <img
        src={thumb}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div
      className="size-full"
      style={{
        background: "radial-gradient(circle at 50% 120%, #4338ca 0%, #020617 72%)",
      }}
    />
  );
}

function AssetThumb({ asset }: { asset: BackgroundAsset }) {
  if (asset.kind === "image") {
    return (
      <img
        src={asset.source}
        alt={asset.name}
        loading="lazy"
        className="size-full object-cover"
      />
    );
  }
  const isIsf = asset.source.startsWith("isf:") || isIsfBackground(asset.source);
  if (isIsf) {
    return <ISFThumb source={asset.source} alt={asset.name} />;
  }
  return (
    <div
      className="size-full"
      style={{
        background: asset.source,
      }}
    />
  );
}

function ThemeCard({
  theme,
  onApply,
  onEdit,
}: {
  theme: SlideTheme;
  onApply: () => void;
  onEdit: () => void;
}) {
  const preview = previewTheme(theme, "music");
  return (
    <div
      draggable
      onDragStart={(event) => setAssetDragData(event, { type: "theme", themeGuid: theme.guid })}
      onDragEnd={() => clearAssetDragData()}
      className="group flex cursor-grab flex-col gap-1 rounded-lg border border-border bg-card/60 p-1.5 active:cursor-grabbing hover:border-primary/40 transition-all select-none"
      title="Arraste para um preview de saída ou para a programação"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black pointer-events-none">
        <ScaledStage
          theme={preview.theme}
          asset={preview.asset}
          props={SAMPLES[preview.asset].props}
        />
      </div>
      <div className="flex items-center gap-1 px-0.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{theme.title}</span>
        <button
          type="button"
          onClick={onApply}
          title="Aplicar na saída selecionada"
          className="flex size-5 items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Editar tema"
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Pencil className="size-3" />
        </button>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onApply,
  onEdit,
  onAddToSetlist,
}: {
  asset: BackgroundAsset;
  onApply: () => void;
  onEdit?: () => void;
  onAddToSetlist?: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={(event) => setAssetDragData(event, { type: "background", asset })}
          onDragEnd={() => clearAssetDragData()}
          className="group flex cursor-grab flex-col gap-1 rounded-lg border border-border bg-card/60 p-1.5 active:cursor-grabbing hover:border-primary/40 transition-all select-none"
          title="Arraste para um preview de saída ou para a programação"
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-900 pointer-events-none">
            <AssetThumb asset={asset} />
          </div>
          <div className="flex items-center gap-1 px-0.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{asset.name}</span>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Editar shader ISF"
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              >
                <Pencil className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={onApply}
              title="Aplicar na saída selecionada"
              className="flex size-5 items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            >
              <Check className="size-3" />
            </button>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52 text-xs">
        <ContextMenuItem onSelect={onApply}>
          <Check className="size-3.5 mr-2 text-emerald-400" />
          <span>Aplicar como Fundo</span>
        </ContextMenuItem>
        {onAddToSetlist && (
          <ContextMenuItem onSelect={onAddToSetlist}>
            <Plus className="size-3.5 mr-2" />
            <span>Adicionar à Programação</span>
          </ContextMenuItem>
        )}
        {onEdit && (
          <ContextMenuItem onSelect={onEdit}>
            <Pencil className="size-3.5 mr-2" />
            <span>Editar Shader ISF</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function MediaPanel() {
  const [tabOrder, setTabOrder] = useState<PanelTab[]>(loadSavedTabOrder);
  const tab = usePanelLayoutStore((s) => s.mediaTab);
  const setTab = usePanelLayoutStore((s) => s.setMediaTab);
  const [draggedTab, setDraggedTab] = useState<PanelTab | null>(null);
  const [dragOverTab, setDragOverTab] = useState<PanelTab | null>(null);
  const [themeSearch, setThemeSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("open_presenter_media_sidebar_open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = (openState: boolean) => {
    setSidebarOpen(openState);
    try {
      localStorage.setItem("open_presenter_media_sidebar_open", String(openState));
    } catch {
      // ignore
    }
  };

  // Diálogo do editor de Shaders ISF
  const [shaderDialogOpen, setShaderDialogOpen] = useState(false);
  const [editingShader, setEditingShader] = useState<CustomISFShader | { id: string; name: string; code?: string; category?: string } | null>(null);

  const open = usePanelLayoutStore((s) => s.mediaOpen);
  const setOpen = usePanelLayoutStore((s) => s.setMediaOpen);

  const themes = useSlideThemesStore((s) => s.themes);
  const outputs = useDisplaysStore((s) => s.outputs);
  const selectedOutputId = useDisplaysStore((s) => s.selectedOutputId);
  const { shaders } = useBackgroundAssets();

  // Bibliotecas com suporte a pastas
  const backgroundsLib = useMediaFolderLibrary("backgrounds");
  const imagesLib = useMediaFolderLibrary("images");
  const videosLib = useMediaFolderLibrary("videos");
  const audiosLib = useMediaFolderLibrary("audios");

  const selectedOutput = outputs.find((o) => o.id === selectedOutputId) ?? null;
  const targetOutput = selectedOutput ?? resolveApplyTarget("public");

  const saveTabOrder = (newOrder: PanelTab[]) => {
    setTabOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_TAB_ORDER_KEY, JSON.stringify(newOrder));
    } catch {
      // ignore
    }
  };

  const handleTabDragStart = (e: React.DragEvent, id: PanelTab) => {
    setDraggedTab(id);
    e.dataTransfer.setData("text/tab-id", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTabDragOver = (e: React.DragEvent, id: PanelTab) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTab !== id) setDragOverTab(id);
  };

  const handleTabDrop = (e: React.DragEvent, targetId: PanelTab) => {
    e.preventDefault();
    const sourceId = (e.dataTransfer.getData("text/tab-id") as PanelTab) || draggedTab;
    setDraggedTab(null);
    setDragOverTab(null);
    if (!sourceId || sourceId === targetId) return;

    const current = [...tabOrder];
    const fromIdx = current.indexOf(sourceId);
    const toIdx = current.indexOf(targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      current.splice(fromIdx, 1);
      current.splice(toIdx, 0, sourceId);
      saveTabOrder(current);
    }
  };

  const themeList = useMemo(() => {
    let list = themes.filter((candidate) => candidate.category !== "presentation");
    if (tab === "lower") {
      list = list.filter((candidate) => candidate.category === "stream");
    }
    if (themeSearch.trim()) {
      const q = themeSearch.toLowerCase().trim();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    return list;
  }, [themes, tab, themeSearch]);

  const handleApplyAsset = (asset: BackgroundAsset) => {
    if (targetOutput) {
      applyBackgroundToOutput(targetOutput, asset);
    } else {
      toast.error("Nenhuma saída compatível encontrada.");
    }
  };

  const handleAddImageToSetlist = async (asset: BackgroundAsset) => {
    const store = useSetlistStore.getState();
    const event = store.event;
    if (!event) {
      toast.error("Nenhum culto/evento ativo na programação.");
      return;
    }
    const partId = event.parts[0]?.id;
    if (!partId) {
      toast.error("O evento precisa de ao menos uma parte.");
      return;
    }
    store.addMedia(partId, {
      kind: "image",
      title: asset.name,
      path: asset.source,
      fit: "contain",
    });
    await store.save();
    toast.success(`"${asset.name}" adicionada à programação.`);
  };

  const handlePresentImage = async (asset: BackgroundAsset) => {
    await usePresentationStore.getState().publishLive({
      id: `img-${Date.now()}`,
      kind: "media",
      title: asset.name,
      lines: [],
      media: {
        title: asset.name,
        kind: "image",
        path: asset.source,
        fit: "contain",
      },
    });
    toast.success(`"${asset.name}" apresentada ao vivo.`);
  };

  const handlePresentVideo = async (asset: BackgroundAsset) => {
    await usePresentationStore.getState().publishLive({
      id: `vid-${Date.now()}`,
      kind: "media",
      title: asset.name,
      lines: [],
      media: {
        title: asset.name,
        kind: "video",
        path: asset.source,
        fit: "contain",
      },
    });
    toast.success(`"${asset.name}" apresentada ao vivo.`);
  };

  const handleAddVideoToSetlist = async (asset: BackgroundAsset) => {
    const store = useSetlistStore.getState();
    const event = store.event;
    if (!event) {
      toast.error("Nenhum culto/evento ativo na programação.");
      return;
    }
    const partId = event.parts[0]?.id;
    if (!partId) {
      toast.error("O evento precisa de ao menos uma parte.");
      return;
    }
    store.addMedia(partId, {
      kind: "video",
      title: asset.name,
      path: asset.source,
      fit: "contain",
    });
    await store.save();
    toast.success(`"${asset.name}" adicionada à programação.`);
  };

  const handlePresentAudio = (asset: BackgroundAsset) => {
    useMediaPlaybackStore.getState().setMedia({
      source: asset.source,
      title: asset.name,
      kind: "audio",
    });
    useMediaPlaybackStore.getState().play();
    toast.success(`"${asset.name}" em reprodução de áudio.`);
  };

  const handleAddAudioToSetlist = async (asset: BackgroundAsset) => {
    const store = useSetlistStore.getState();
    const event = store.event;
    if (!event) {
      toast.error("Nenhum culto/evento ativo na programação.");
      return;
    }
    const partId = event.parts[0]?.id;
    if (!partId) {
      toast.error("O evento precisa de ao menos uma parte.");
      return;
    }
    store.addMedia(partId, {
      kind: "audio",
      title: asset.name,
      path: asset.source,
    });
    await store.save();
    toast.success(`"${asset.name}" adicionada à programação.`);
  };

  if (!open) {
    return (
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-card/40 px-3 select-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
          title="Expandir painel de mídias"
        >
          <ChevronUp className="size-3.5" />
          Mídias
        </button>
        <span className="truncate text-[10px] text-muted-foreground">
          {targetOutput
            ? `Alvo: ${targetOutput.name}`
            : "Arraste temas/fundos para os previews"}
        </span>
      </div>
    );
  }

  return (
    <section
      aria-label="Painel de mídias"
      className="flex h-full w-full min-h-0 border-t border-border bg-card/40"
    >
      {/* Sidebar vertical de abas organizáveis via Drag and Drop */}
      {sidebarOpen && (
        <div className="flex w-38 shrink-0 flex-col border-r border-border bg-muted/20 select-none">
          <div className="flex h-9 items-center justify-between border-b border-border px-2.5">
            <span className="text-xs font-semibold text-foreground">Mídias</span>
            <button
              type="button"
              onClick={() => toggleSidebar(false)}
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
              title="Ocultar abas laterais de mídias"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 p-1 overflow-y-auto">
            {tabOrder.map((id) => {
              const def = TAB_DEFINITIONS[id];
              if (!def) return null;
              const Icon = def.icon;
              const isSelected = tab === id;
              const isDragOver = dragOverTab === id;
              const isDragging = draggedTab === id;

              return (
                <button
                  key={id}
                  type="button"
                  draggable
                  onDragStart={(e) => handleTabDragStart(e, id)}
                  onDragOver={(e) => handleTabDragOver(e, id)}
                  onDragLeave={() => setDragOverTab(null)}
                  onDrop={(e) => handleTabDrop(e, id)}
                  onClick={() => setTab(id)}
                  className={cn(
                    "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all cursor-pointer select-none",
                    isSelected
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    isDragOver && "ring-2 ring-primary border-primary",
                    isDragging && "opacity-40",
                  )}
                  title={`Aba ${def.label} (arraste para reordenar)`}
                >
                  <GripVertical className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{def.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior de status & alvo */}
        <div className="flex h-9 items-center justify-between border-b border-border px-3 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => toggleSidebar(true)}
                className="flex size-5 items-center justify-center rounded border border-border/80 bg-background text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors shrink-0 mr-1"
                title="Mostrar abas laterais de mídias"
              >
                <PanelLeftOpen className="size-3.5" />
              </button>
            )}
            <span className="truncate text-muted-foreground">
              {targetOutput
                ? `Alvo: ${targetOutput.name}`
                : "Alvo: primeira saída compatível"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {targetOutput && (
              <button
                type="button"
                onClick={() => {
                  clearOverrideForOutput(targetOutput.id);
                  toast.success(
                    `Fundo ao vivo limpo em ${targetOutput.name}. Tema padrão restaurado.`,
                  );
                }}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-destructive/15 hover:text-destructive cursor-pointer transition-colors"
                title={`Limpar ação ao vivo de ${targetOutput.name} e restaurar tema padrão`}
              >
                <X className="size-3" />
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Recolher painel de mídias"
              title="Recolher painel"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Área do Conteúdo da Aba Ativa */}
        <div className="flex-1 overflow-y-auto p-2.5">
          {tab === "presentations" ? (
            <MediaPresentationsBrowser />
          ) : tab === "studio" ? (
            <MediaStudioBrowser />
          ) : tab === "bible" ? (
            <div className="h-full w-full overflow-hidden">
              <BiblePage />
            </div>
          ) : tab === "themes" || tab === "lower" ? (
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={themeSearch}
                  onChange={(e) => setThemeSearch(e.target.value)}
                  placeholder={`Buscar em ${tab === "lower" ? "lower thirds" : "temas"}…`}
                  className="h-7 w-full pl-8 pr-7 text-xs rounded-md border border-input bg-muted/40 text-foreground"
                />
                {themeSearch && (
                  <button
                    type="button"
                    onClick={() => setThemeSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {themeList.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum tema encontrado.
                </p>
              ) : (
                <div className="grid [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {themeList.map((theme) => (
                    <ThemeCard
                      key={theme.guid}
                      theme={theme}
                      onApply={() => {
                        const target =
                          selectedOutput ?? resolveApplyTarget(preferredCategoryForTheme(theme));
                        if (target) applyThemeToOutput(target, theme.guid);
                      }}
                      onEdit={() => void openThemeEditor(theme.guid)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : tab === "backgrounds" ? (
            <MediaFolderBrowser
              kind="backgrounds"
              lib={backgroundsLib}
              targetOutputName={targetOutput?.name}
              onApplyAsset={handleApplyAsset}
              onPresentAsset={handlePresentImage}
              onAddToSetlist={handleAddImageToSetlist}
            />
          ) : tab === "videos" ? (
            <MediaFolderBrowser
              kind="videos"
              lib={videosLib}
              targetOutputName={targetOutput?.name}
              onApplyAsset={handleApplyAsset}
              onPresentAsset={handlePresentVideo}
              onAddToSetlist={handleAddVideoToSetlist}
            />
          ) : tab === "images" ? (
            <MediaFolderBrowser
              kind="images"
              lib={imagesLib}
              targetOutputName={targetOutput?.name}
              onApplyAsset={handleApplyAsset}
              onPresentAsset={handlePresentImage}
              onAddToSetlist={handleAddImageToSetlist}
            />
          ) : tab === "audios" ? (
            <MediaFolderBrowser
              kind="audios"
              lib={audiosLib}
              targetOutputName={targetOutput?.name}
              onApplyAsset={handleApplyAsset}
              onPresentAsset={handlePresentAudio}
              onAddToSetlist={handleAddAudioToSetlist}
            />
          ) : tab === "songs" ? (
            <MediaSongsBrowser />
          ) : (
            /* Shaders ISF */
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Shaders ISF (Interactive Shader Format)
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingShader(null);
                    setShaderDialogOpen(true);
                  }}
                  className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
                  title="Criar novo shader personalizado ISF 2.0"
                >
                  <Plus className="size-3.5" />
                  <span>Novo Shader ISF</span>
                </Button>
              </div>

              {shaders.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum shader disponível.
                </p>
              ) : (
                <div className="grid [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {shaders.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onApply={() => handleApplyAsset(asset)}
                      onEdit={() => {
                        const cleanId = asset.id.replace("shader:isf-", "").replace("shader:", "");
                        const isCustom = cleanId.startsWith("custom-");
                        if (isCustom) {
                          const realId = cleanId.replace("custom-", "");
                          const found = useMediaShadersStore.getState().customShaders.find((c) => c.id === realId);
                          setEditingShader(found ?? { id: realId, name: asset.name });
                        } else {
                          const preset = ISF_PRESETS.find((p) => p.id === cleanId);
                          setEditingShader(
                            preset
                              ? {
                                  id: preset.id,
                                  name: preset.name,
                                  code: preset.code,
                                  category: preset.category,
                                }
                              : { id: cleanId, name: asset.name },
                          );
                        }
                        setShaderDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialog do Editor de Shaders ISF */}
      <ISFShaderDialog
        open={shaderDialogOpen}
        onOpenChange={setShaderDialogOpen}
        shaderToEdit={editingShader}
      />
    </section>
  );
}
