import { useMemo, useState } from "react";
import type { BackgroundLayer, DisplayOutput, MasterLayerId, MonitorInfo } from "@/core/types";
import { kindToAsset } from "@/core/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ban,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Layers as LayersIcon,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { slugify } from "../store";
import { COMMON_RESOLUTIONS } from "../types";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { cloneTheme, getPageForContext, materializePage } from "@/features/slide-themes/pages";
import { contextForSlide } from "@/features/slide-themes/themeResolution";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_THEME,
  DEFAULT_STREAM_THEME,
} from "@/features/slide-themes/seedThemes";
import {
  MASTER_LAYER_LABELS,
  MASTER_LAYER_ORDER,
  resolveOutputLook,
} from "@/features/slide-themes/layers";
import { isBackgroundCompatible, themeSupportsCategory } from "@/features/slide-themes/outputPlan";
import { useOutputOverridesStore } from "@/features/slide-themes/outputOverridesStore";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import { useStageConfigStore } from "@/features/stage-display/configStore";
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import { usePresentationStore } from "@/features/presentation/store";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";
import { wallpaperToBackground } from "@/features/presentation/wallpaper";
import { SlideTransition } from "@/features/presentation/SlideTransition";
import { BackgroundRenderer } from "@/features/media-shaders/BackgroundRenderer";
import { PersistentBackground } from "@/features/media-shaders/PersistentBackground";
import { openThemeEditor, saveThemeMedia } from "@/core/ipc/commands";
import { BrandMark } from "@/components/BrandMark";
import { OutputPlaceholder } from "./OutputPlaceholder";
import { isTauri } from "@/core/ipc/tauri";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";

interface DisplaysTabsPanelProps {
  output: DisplayOutput;
  monitors: MonitorInfo[];
  onUpdate: (patch: Partial<DisplayOutput>) => Promise<void>;
}

export function DisplaysTabsPanel({
  output,
  monitors,
  onUpdate,
}: DisplaysTabsPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("hardware");
  const themes = useSlideThemesStore((s) => s.themes);
  const saveTheme = useSlideThemesStore((s) => s.save);
  const override = useOutputOverridesStore((s) => s.overrides[output.id] ?? null);
  const setOverride = useOutputOverridesStore((s) => s.setOverride);

  const live = usePresentationStore((s) => s.live);
  const wallpaper = useWallpaperStore((s) => s.wallpaper);

  const {
    clock24h,
    showSeconds,
    nextSlideDisplay,
    countdownMinutes,
    updateConfig: updateStageConfig,
  } = useStageConfigStore();

  const [uploadingPlaceholder, setUploadingPlaceholder] = useState(false);

  async function handlePlaceholderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPlaceholder(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeName = `output_${output.id}_${Date.now()}.${ext}`;
      let savedUrl = "";
      try {
        savedUrl = await saveThemeMedia("wallpapers", safeName, Array.from(bytes));
      } catch {
        const reader = new FileReader();
        savedUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      await onUpdate({
        placeholderEnabled: true,
        placeholderType: "image",
        placeholderUrl: savedUrl,
      });
      toast.success("Imagem de plano de fundo aplicada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar imagem de plano de fundo.");
    } finally {
      setUploadingPlaceholder(false);
      e.target.value = "";
    }
  }

  // Selected resolution preset or custom
  const currentResKey =
    COMMON_RESOLUTIONS.find(
      (r) =>
        r.width === output.resolution.width &&
        r.height === output.resolution.height,
    )?.label ?? "Personalizado...";

  async function handleCreateNewTheme() {
    try {
      let baseTheme = DEFAULT_PUBLIC_THEME;
      let title = `Modelo Público — ${output.name}`;
      let category: "theme" | "stage" | "stream" = "theme";

      if (output.category === "stage") {
        baseTheme = DEFAULT_STAGE_THEME;
        title = `Modelo Palco — ${output.name}`;
        category = "stage";
      } else if (output.category === "lower") {
        baseTheme = DEFAULT_STREAM_THEME;
        title = `Modelo Lower Third — ${output.name}`;
        category = "stream";
      }

      const newTheme = cloneTheme(baseTheme, title);
      newTheme.category = category;
      await saveTheme(newTheme);
      await onUpdate({ defaultThemeGuid: newTheme.guid });

      toast.success("Novo modelo criado com sucesso!");
      if (isTauri()) {
        void openThemeEditor(newTheme.guid);
      }
    } catch (err) {
      toast.error("Erro ao criar modelo de tema.");
      console.error(err);
    }
  }

  function handleEditSelectedTheme() {
    if (!output.defaultThemeGuid) return;
    if (isTauri()) {
      void openThemeEditor(output.defaultThemeGuid);
    } else {
      toast.info("Editor de temas disponível no aplicativo desktop.");
    }
  }

  function handleResolutionPreset(label: string) {
    const preset = COMMON_RESOLUTIONS.find((r) => r.label === label);
    if (!preset) return;
    void onUpdate({
      resolution: { width: preset.width, height: preset.height },
      aspectRatio: preset.aspectRatio,
    });
  }

  const selectedTheme = themes.find((t) => t.guid === output.defaultThemeGuid);

  // Tema ativo e materializado para a prévia da tela
  const activeTheme = useMemo(() => {
    if (output.defaultThemeGuid) {
      const explicit = themes.find((t) => t.guid === output.defaultThemeGuid);
      if (explicit) return explicit;
    }
    if (output.category === "lower") {
      return themes.find((t) => t.category === "stream") ?? DEFAULT_STREAM_THEME;
    }
    if (output.category === "stage") {
      return themes.find((t) => t.category === "stage") ?? DEFAULT_STAGE_THEME;
    }
    return (
      themes.find((t) => t.category !== "stage" && t.category !== "stream") ??
      DEFAULT_PUBLIC_THEME
    );
  }, [themes, output.defaultThemeGuid, output.category]);

  const isPresenting = live.content.kind !== "blank" && !live.cleared;
  const context = contextForSlide(live.content.kind, live.content.media?.kind) ?? "music";

  const materializedTheme = useMemo(() => {
    if (activeTheme.pages?.length) {
      const page = getPageForContext(activeTheme, context) ?? activeTheme.pages[0];
      return page ? materializePage(activeTheme, page) : activeTheme;
    }
    return activeTheme;
  }, [activeTheme, context]);

  const sampleTheme = useMemo(() => {
    if (activeTheme.pages?.length) {
      const page = getPageForContext(activeTheme, "music") ?? activeTheme.pages[0];
      return page ? materializePage(activeTheme, page) : activeTheme;
    }
    return activeTheme;
  }, [activeTheme]);

  const isTransparent =
    (output.category === "lower" && !output.backgroundColorEnabled) ||
    output.backgroundColor === "transparent" ||
    output.backgroundColor?.startsWith("rgba(0, 0, 0, 0)") ||
    output.backgroundColor?.startsWith("rgba(0,0,0,0)");

  const effectiveBg = output.backgroundColorEnabled
    ? output.backgroundColor
    : output.category === "lower"
      ? "transparent"
      : "#000000";

  const recommendedThemes = useMemo(() => {
    return themes.filter((t) => themeSupportsCategory(t, output.category));
  }, [themes, output.category]);

  const otherThemes = useMemo(() => {
    return themes.filter((t) => !themeSupportsCategory(t, output.category));
  }, [themes, output.category]);

  const look = resolveOutputLook(output);

  function setLayer(layer: MasterLayerId, value: boolean) {
    void onUpdate({ look: { ...look, [layer]: value } });
  }

  function applyColorOverride(value: string) {
    const background: BackgroundLayer = {
      id: `override-${output.id}-${Date.now()}`,
      kind: "color",
      value,
    };
    setOverride(output.id, { background, updatedAt: new Date().toISOString() });
  }

  function applyWallpaperOverride() {
    if (!wallpaper) return;
    const background = wallpaperToBackground(wallpaper);
    if (!isBackgroundCompatible(output.category, background)) {
      toast.error("Este fundo não é compatível com saídas Lower Third.");
      return;
    }
    setOverride(output.id, { background, updatedAt: new Date().toISOString() });
  }

  const PRESET_COLORS = [
    { name: "Preto", value: "#000000" },
    { name: "Azul Meia-Noite", value: "#0f172a" },
    { name: "Cinza Escuro", value: "#18181b" },
    { name: "Azul Escuro", value: "#1e3a8a" },
    { name: "Branco", value: "#ffffff" },
    { name: "Transparente", value: "rgba(0,0,0,0)" },
  ];

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/90 flex flex-col shrink-0 select-none">
      {/* Tabs Header bar */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-zinc-300">
            {output.monitorName || output.name}
          </span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-zinc-700 text-zinc-400 font-mono">
            {output.type.toUpperCase()}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-zinc-950/80 border border-zinc-800 h-8 p-0.5">
            <TabsTrigger
              value="hardware"
              className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Hardware
            </TabsTrigger>
            <TabsTrigger
              value="cor"
              className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Cor
            </TabsTrigger>
            <TabsTrigger
              value="fundo"
              className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Plano de Fundo
            </TabsTrigger>
            <TabsTrigger
              value="template"
              className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Modelo Padrão
            </TabsTrigger>
            <TabsTrigger
              value="look"
              className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white gap-1"
            >
              <LayersIcon className="size-3" />
              Camadas
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white gap-1"
            >
              <Eye className="size-3" />
              Prévia da Tela
            </TabsTrigger>
            {output.category === "stage" && (
              <TabsTrigger
                value="palco"
                className="text-xs px-2.5 py-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
              >
                Palco & Relógio
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-zinc-400 hover:text-white"
          title="Ajuda sobre configurações de saída"
        >
          <HelpCircle className="size-4" />
        </Button>
      </div>

      {/* Tabs Content */}
      <div className="p-4 flex-1 overflow-y-auto">
        {/* Tab 1: Hardware / Conexão */}
        {activeTab === "hardware" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Saída Selector & Destino */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Saída
                </label>
                {output.type === "monitor" ? (
                  <Select
                    value={output.monitorId ?? ""}
                    onValueChange={(val) => {
                      const mon = monitors.find((m) => m.id === val);
                      void onUpdate({
                        monitorId: val,
                        monitorName: mon?.name ?? "Monitor",
                        resolution: mon
                          ? { width: mon.width, height: mon.height }
                          : output.resolution,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <div className="size-2 rounded-full bg-blue-500 shrink-0" />
                        <SelectValue placeholder="Selecione um monitor físico..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200">
                      {monitors.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.width}x{m.height}) {m.isPrimary ? "• Principal" : ""}
                        </SelectItem>
                      ))}
                      {monitors.length === 0 && (
                        <SelectItem value="none" disabled>
                          Nenhum monitor físico detectado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-zinc-500 select-none">/#/output/</span>
                      <Input
                        value={output.slug || slugify(output.name)}
                        onChange={(e) => {
                          const cleanSlug = e.target.value.toLowerCase().replace(/[^\w-]/g, "");
                          void onUpdate({
                            slug: cleanSlug,
                            url: `/#/output/${cleanSlug}`,
                          });
                        }}
                        placeholder="slug-personalizado"
                        className="h-8 bg-zinc-950 border-zinc-800 text-xs font-mono flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px] text-zinc-400 hover:text-white"
                        onClick={() => {
                          const auto = slugify(output.name);
                          void onUpdate({ slug: auto, url: `/#/output/${auto}` });
                        }}
                        title="Auto a partir do Nome"
                      >
                        <Sparkles className="size-3 mr-1 text-indigo-400" />
                        Auto
                      </Button>
                    </div>

                    {/* Full URL with Copy and Open */}
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-zinc-950 border border-zinc-800/80 text-[11px]">
                      <div className="flex items-center gap-1.5 text-zinc-400 truncate font-mono">
                        <Globe className="size-3 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {window.location.origin}/#/output/{output.slug || slugify(output.name)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-zinc-400 hover:text-white"
                          onClick={() => {
                            const full = `${window.location.origin}/#/output/${output.slug || slugify(output.name)}`;
                            void navigator.clipboard.writeText(full);
                            toast.success("Link copiado para o OBS/Navegador!");
                          }}
                          title="Copiar URL"
                        >
                          <Copy className="size-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-zinc-400 hover:text-white"
                          onClick={() => {
                            const full = `${window.location.origin}/#/output/${output.slug || slugify(output.name)}`;
                            window.open(full, "_blank");
                          }}
                          title="Abrir no Navegador"
                        >
                          <ExternalLink className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Resolution */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  {output.type === "monitor" ? "Resolução do Hardware" : "Resolução da Janela Web"}
                </label>
                {output.type === "monitor" ? (
                  <div className="flex items-center justify-between h-8 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200">
                    <span>{output.resolution.width} x {output.resolution.height}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-zinc-700 text-zinc-400">
                      {output.aspectRatio || "16:9"} • Nativo
                    </Badge>
                  </div>
                ) : (
                  <Select value={currentResKey} onValueChange={handleResolutionPreset}>
                    <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200">
                      {COMMON_RESOLUTIONS.map((r) => (
                        <SelectItem key={r.label} value={r.label}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Cor / Plano de Fundo */}
        {activeTab === "cor" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-200">Cor de Fundo da Saída</div>
                <div className="text-[11px] text-zinc-400">
                  Define a cor sólida base exibida sob os slides e mídia nesta saída.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Ativar cor</span>
                <Switch
                  checked={output.backgroundColorEnabled}
                  onCheckedChange={(checked) => void onUpdate({ backgroundColorEnabled: checked })}
                  className="scale-75"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Native / Custom Color Input */}
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1">
                <input
                  type="color"
                  value={
                    output.backgroundColor.startsWith("#") ? output.backgroundColor : "#000000"
                  }
                  onChange={(e) =>
                    void onUpdate({
                      backgroundColor: e.target.value,
                      backgroundColorEnabled: true,
                    })
                  }
                  className="size-6 rounded border border-zinc-700 bg-transparent cursor-pointer"
                />
                <Input
                  value={output.backgroundColor}
                  onChange={(e) => void onUpdate({ backgroundColor: e.target.value })}
                  className="h-6 w-24 bg-transparent border-0 text-xs font-mono p-0 focus-visible:ring-0"
                  placeholder="#000000"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      void onUpdate({
                        backgroundColor: preset.value,
                        backgroundColorEnabled: true,
                      })
                    }
                    className={cn(
                      "size-6 rounded border transition-transform hover:scale-110",
                      preset.value === "rgba(0,0,0,0)"
                        ? "border-purple-500/50 bg-[repeating-conic-gradient(#374151_0%_25%,#1f2937_0%_50%)_50%/8px_8px]"
                        : "border-zinc-700",
                    )}
                    style={{
                      backgroundColor:
                        preset.value !== "rgba(0,0,0,0)" ? preset.value : undefined,
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Plano de Fundo / Placeholder da Saída */}
        {activeTab === "fundo" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Configuração */}
            <div className="space-y-4 lg:col-span-7">
              {/* Header / Switch */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">
                    Plano de Fundo / Placeholder
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Exibido nesta tela quando nenhum slide estiver sendo apresentado ou durante momentos de espera.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Ativar fundo</span>
                  <Switch
                    checked={output.placeholderEnabled ?? true}
                    onCheckedChange={(checked) =>
                      void onUpdate({ placeholderEnabled: checked })
                    }
                    className="scale-75"
                  />
                </div>
              </div>

              {/* Type Selection: 3 Cards */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Tipo de Plano de Fundo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Option 1: Logo Open Presenter */}
                  <div
                    onClick={() =>
                      void onUpdate({
                        placeholderEnabled: true,
                        placeholderType: "logo",
                      })
                    }
                    className={cn(
                      "flex flex-col gap-1.5 p-3 rounded-lg border text-left cursor-pointer transition-all",
                      (output.placeholderType ?? "logo") === "logo" && (output.placeholderEnabled ?? true)
                        ? "border-indigo-500 bg-indigo-500/10 text-white shadow-xs"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <BrandMark className="size-4 text-indigo-400" />
                      <span className="text-xs font-semibold">Logo Oficial</span>
                    </div>
                    <span className="text-[10px] leading-relaxed opacity-80">
                      Logo do Open Presenter sobre degradê escuro refinado.
                    </span>
                  </div>

                  {/* Option 2: Imagem Personalizada */}
                  <div
                    onClick={() =>
                      void onUpdate({
                        placeholderEnabled: true,
                        placeholderType: "image",
                      })
                    }
                    className={cn(
                      "flex flex-col gap-1.5 p-3 rounded-lg border text-left cursor-pointer transition-all",
                      output.placeholderType === "image" && (output.placeholderEnabled ?? true)
                        ? "border-indigo-500 bg-indigo-500/10 text-white shadow-xs"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-4 text-emerald-400" />
                      <span className="text-xs font-semibold">Imagem Própria</span>
                    </div>
                    <span className="text-[10px] leading-relaxed opacity-80">
                      Carregue o logo da sua igreja ou uma arte personalizada.
                    </span>
                  </div>

                  {/* Option 3: Desativado (Apenas Cor) */}
                  <div
                    onClick={() =>
                      void onUpdate({
                        placeholderEnabled: false,
                        placeholderType: "none",
                      })
                    }
                    className={cn(
                      "flex flex-col gap-1.5 p-3 rounded-lg border text-left cursor-pointer transition-all",
                      output.placeholderType === "none" || output.placeholderEnabled === false
                        ? "border-indigo-500 bg-indigo-500/10 text-white shadow-xs"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Ban className="size-4 text-zinc-400" />
                      <span className="text-xs font-semibold">Sem Fundo</span>
                    </div>
                    <span className="text-[10px] leading-relaxed opacity-80">
                      Utiliza apenas a cor sólida configurada na aba Cor.
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Image Upload & Controls (When Image Type is active) */}
              {output.placeholderType === "image" && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Arquivo da Imagem
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        Formatos aceitos: PNG, JPG, WebP ou SVG.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handlePlaceholderUpload(e)}
                          className="hidden"
                          disabled={uploadingPlaceholder}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 text-xs border-zinc-700 hover:bg-zinc-800 gap-1.5 cursor-pointer"
                        >
                          <span>
                            <Upload className="size-3" />
                            {uploadingPlaceholder ? "Enviando..." : output.placeholderUrl ? "Trocar Imagem" : "Escolher Imagem"}
                          </span>
                        </Button>
                      </label>

                      {output.placeholderUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void onUpdate({ placeholderUrl: null })}
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                          title="Remover imagem"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Fit Mode */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                    <span className="text-[11px] text-zinc-400">Ajuste da Imagem (Fit)</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "contain", label: "Conter (Aspecto)" },
                        { id: "cover", label: "Preencher Tela" },
                        { id: "center", label: "Centralizado (1:1)" },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() =>
                            void onUpdate({
                              placeholderFit: mode.id as "contain" | "cover" | "center",
                            })
                          }
                          className={cn(
                            "px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border",
                            (output.placeholderFit ?? "contain") === mode.id
                              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                              : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Mini Preview of Placeholder */}
            <div className="space-y-2 lg:col-span-5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Eye className="size-3.5 text-indigo-400" />
                    Prévia do Plano de Fundo
                  </span>
                  <Badge variant="outline" className="h-4 text-[9px] font-mono border-zinc-800 text-zinc-400">
                    16:9
                  </Badge>
                </div>

                <div
                  className="relative aspect-video w-full overflow-hidden rounded-md border border-zinc-800 shadow-inner"
                  style={{
                    backgroundColor: output.backgroundColorEnabled ? output.backgroundColor : "#000000",
                  }}
                >
                  <OutputPlaceholder output={output} />
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "template" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Modelo de Tema Padrão
                </div>
                <div className="text-[11px] text-zinc-400">
                  Slides exibidos nesta saída herdarão este modelo visual caso não possuam tema próprio.
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => void handleCreateNewTheme()}
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
              >
                <Plus className="size-3.5" />
                Criar Novo Modelo
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Selecionar Modelo Existente
                </label>
                <Select
                  value={output.defaultThemeGuid ?? "none"}
                  onValueChange={(val) => {
                    const newGuid = val === "none" ? null : val;
                    void onUpdate({ defaultThemeGuid: newGuid });
                  }}
                >
                  <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-xs">
                    <SelectValue placeholder="Nenhum (Padrão do Sistema)" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200 max-h-60">
                    <SelectItem value="none">Nenhum (Padrão do Sistema)</SelectItem>
                    {recommendedThemes.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-950/40">
                          Recomendados ({output.category === "stage" ? "Palco" : output.category === "lower" ? "Lower Thirds" : "Público"})
                        </div>
                        {recommendedThemes.map((t) => (
                          <SelectItem key={t.guid} value={t.guid}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {otherThemes.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-950/40 mt-1">
                          Outros Modelos (incompatíveis)
                        </div>
                        {otherThemes.map((t) => (
                          <SelectItem key={t.guid} value={t.guid} disabled>
                            {t.title} — incompatível
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTheme && (
                <div className="flex items-center justify-between p-2 rounded-md bg-zinc-950 border border-zinc-800">
                  <div className="truncate">
                    <div className="text-xs font-medium text-zinc-200 truncate">
                      {selectedTheme.title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {selectedTheme.elements?.length || 0} elementos no layout
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditSelectedTheme}
                    className="h-7 text-xs border-zinc-700 hover:bg-zinc-800 ml-2"
                  >
                    Editar Modelo
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Camadas (Look da saída) */}
        {activeTab === "look" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="space-y-3 lg:col-span-7">
              <div className="pb-2 border-b border-zinc-800/80">
                <div className="text-xs font-semibold text-zinc-200">
                  Camadas da Saída (Look)
                </div>
                <div className="text-[11px] text-zinc-400">
                  Define o que esta saída entrega. O tema continua pronto para tudo; a saída decide o que aparece.
                </div>
              </div>

              <div className="space-y-1.5">
                {MASTER_LAYER_ORDER.map((layer) => {
                  const isScreenColor = layer === "screenColor";
                  const checked = isScreenColor ? output.backgroundColorEnabled : look[layer];
                  const noRenderer =
                    layer !== "slide" && layer !== "messages" && !isScreenColor;
                  const stageDisables = output.category === "stage" && layer !== "messages";
                  const disabled = isScreenColor ? false : noRenderer || stageDisables;
                  const hint = stageDisables
                    ? "Não se aplica ao Stage nesta fase"
                    : noRenderer
                      ? "Sem renderer nesta fase"
                      : undefined;
                  return (
                    <label
                      key={layer}
                      className={cn(
                        "flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs",
                        disabled && "opacity-60",
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-zinc-200">{MASTER_LAYER_LABELS[layer]}</span>
                        {hint && (
                          <span className="text-[10px] text-zinc-500 truncate">— {hint}</span>
                        )}
                      </span>
                      <Switch
                        checked={checked}
                        disabled={disabled}
                        className="scale-75"
                        onCheckedChange={(value) => {
                          if (isScreenColor) void onUpdate({ backgroundColorEnabled: value });
                          else setLayer(layer, value);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 lg:col-span-5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-3">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <LayersIcon className="size-3.5 text-indigo-400" />
                  Fundo da Saída
                </span>
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  Substitui o fundo do tema só nesta saída. O texto e as outras saídas não mudam.
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-zinc-700 hover:bg-zinc-800"
                    onClick={() => setOverride(output.id, null)}
                    disabled={!override?.background}
                  >
                    Usar fundo do tema
                  </Button>
                  <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1">
                    <input
                      type="color"
                      value={
                        override?.background?.value?.startsWith("#")
                          ? override.background.value
                          : "#000000"
                      }
                      onChange={(e) => applyColorOverride(e.target.value)}
                      className="size-5 rounded border border-zinc-700 bg-transparent cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono">cor</span>
                  </div>
                  {output.category !== "lower" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-zinc-700 hover:bg-zinc-800"
                      onClick={applyWallpaperOverride}
                      disabled={!wallpaper}
                      title={wallpaper ? "Aplicar o papel de parede atual" : "Defina um papel de parede no admin"}
                    >
                      Wallpaper atual
                    </Button>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {override?.background
                    ? `Override ativo (${override.background.kind}).`
                    : "Sem override — usando o fundo do tema."}
                  {output.category === "lower" && " Lower Third aceita apenas cor/transparente."}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 text-[11px] text-zinc-400 leading-relaxed">
                O tema do evento e a ação ao vivo (este painel) podem sobrepor o modelo padrão.
                Prioridade: <span className="text-zinc-200">ao vivo &gt; evento &gt; padrão da saída</span>.
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Prévia da Tela (Live & Theme Real-Time Preview) */}
        {activeTab === "preview" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Output Status & Information */}
            <div className="space-y-3 lg:col-span-5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200">
                      {output.monitorName || output.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-zinc-700 text-zinc-400 font-mono">
                      {output.type.toUpperCase()}
                    </Badge>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] h-5 px-2 gap-1.5 font-mono uppercase",
                      output.enabled
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        output.enabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500",
                      )}
                    />
                    {output.enabled ? "Ativo" : "Desativado"}
                  </Badge>
                </div>

                {/* Projection / Presentation Status */}
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs">
                  <span className="text-zinc-400">Estado de Projeção</span>
                  <span
                    className={cn(
                      "font-medium flex items-center gap-1.5",
                      isPresenting ? "text-emerald-400" : "text-zinc-400",
                    )}
                  >
                    <Radio
                      className={cn("size-3.5", isPresenting && "animate-pulse text-emerald-400")}
                    />
                    {isPresenting ? "Transmitindo ao vivo" : "Em repouso / Espera"}
                  </span>
                </div>

                {/* Applied Theme */}
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Modelo Aplicado</span>
                    <span className="font-medium text-zinc-200 truncate max-w-[160px] block">
                      {selectedTheme?.title ??
                        (output.category === "lower"
                          ? "Lower Third Padrão"
                          : output.category === "stage"
                            ? "Palco Padrão"
                            : "Padrão do Sistema")}
                    </span>
                  </div>
                  {selectedTheme && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditSelectedTheme}
                      className="h-6 text-[11px] border-zinc-700 hover:bg-zinc-800"
                    >
                      Editar Tema
                    </Button>
                  )}
                </div>

                {/* Resolution & Aspect */}
                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>Resolução & Proporção:</span>
                  <span className="font-mono text-zinc-300">
                    {output.resolution.width} x {output.resolution.height} ({output.aspectRatio || "16:9"})
                  </span>
                </div>

                {/* Quick actions for Web outputs */}
                {output.type === "html" && (
                  <div className="pt-1 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-zinc-700 hover:bg-zinc-800 gap-1.5 flex-1"
                      onClick={() => {
                        const full = `${window.location.origin}/#/output/${output.slug || slugify(output.name)}`;
                        window.open(full, "_blank");
                      }}
                    >
                      <ExternalLink className="size-3" />
                      Abrir Tela
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-zinc-700 hover:bg-zinc-800 gap-1.5 flex-1"
                      onClick={() => {
                        const full = `${window.location.origin}/#/output/${output.slug || slugify(output.name)}`;
                        void navigator.clipboard.writeText(full);
                        toast.success("Link copiado para o OBS/Navegador!");
                      }}
                    >
                      <Copy className="size-3" />
                      Copiar Link
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Real-Time Preview Display */}
            <div className="space-y-2 lg:col-span-7">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Eye className="size-3.5 text-indigo-400" />
                    Prévia em Tempo Real
                  </span>
                  <Badge variant="outline" className="h-4 text-[9px] font-mono border-zinc-800 text-zinc-400">
                    {isPresenting ? "Slide ao Vivo" : "Modelo do Tema"}
                  </Badge>
                </div>

                <div
                  className="relative aspect-video w-full overflow-hidden rounded-md border border-zinc-800 shadow-inner"
                  style={{
                    backgroundColor: isTransparent ? "transparent" : effectiveBg,
                    backgroundImage: isTransparent
                      ? "repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 12px 12px"
                      : undefined,
                  }}
                >
                  {output.category === "stage" ? (
                    <div className="relative w-full h-full bg-black">
                      <StageMiniPreview outputId={output.id} />
                    </div>
                  ) : output.category === "lower" ? (
                    <div className="relative w-full h-full">
                      {isPresenting ? (
                        <SlideTransition
                          slide={live}
                          theme={materializedTheme}
                          asset={kindToAsset(live.content.kind)}
                          cleared={live.cleared}
                          textHidden={live.textHidden}
                          durationMs={300}
                          transitionBackground={false}
                        />
                      ) : (
                        <div className="relative w-full h-full">
                          <ScaledStage
                            theme={sampleTheme}
                            asset="music"
                            props={SAMPLES.music.props}
                            showBackground={false}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Public Output */
                    <div className="relative w-full h-full">
                      {isPresenting ? (
                        <>
                          <PersistentBackground background={live.background} />
                          <div className="absolute inset-0">
                            <SlideTransition
                              slide={live}
                              theme={materializedTheme}
                              asset={kindToAsset(live.content.kind)}
                              cleared={live.cleared}
                              textHidden={live.textHidden}
                              durationMs={300}
                              transitionBackground={false}
                            />
                          </div>
                        </>
                      ) : (output.placeholderEnabled ?? true) && output.placeholderType !== "none" ? (
                        <div className="relative w-full h-full">
                          <OutputPlaceholder output={output} />
                        </div>
                      ) : wallpaper ? (
                        <div className="relative w-full h-full">
                          <BackgroundRenderer background={wallpaperToBackground(wallpaper)} />
                          <div className="absolute inset-0">
                            <ScaledStage
                              theme={sampleTheme}
                              asset="music"
                              props={SAMPLES.music.props}
                              showBackground={false}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-full">
                          <ScaledStage
                            theme={sampleTheme}
                            asset="music"
                            props={SAMPLES.music.props}
                            showBackground={false}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Palco & Relógio (Stage Output Only) */}
        {activeTab === "palco" && output.category === "stage" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Settings */}
            <div className="space-y-4 lg:col-span-7">
              <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-sky-400" />
                  Tempo & Relógio do Palco
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 p-2 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                    <span className="text-zinc-300">Formato 24h</span>
                    <input
                      type="checkbox"
                      checked={clock24h}
                      onChange={(e) => updateStageConfig({ clock24h: e.target.checked })}
                      className="size-4 accent-sky-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 p-2 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                    <span className="text-zinc-300">Exibir Segundos</span>
                    <input
                      type="checkbox"
                      checked={showSeconds}
                      onChange={(e) => updateStageConfig({ showSeconds: e.target.checked })}
                      className="size-4 accent-sky-500 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 p-2 text-xs">
                  <div>
                    <span className="text-zinc-300 font-medium">
                      Contagem Regressiva (Timer)
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      0 = cronômetro progressivo normal
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={countdownMinutes}
                      onChange={(e) =>
                        updateStageConfig({
                          countdownMinutes: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-7 w-16 bg-zinc-950 border-zinc-800 text-xs text-right font-mono"
                    />
                    <span className="text-xs text-zinc-400">min</span>
                  </div>
                </div>
              </div>

              {/* Next slide display */}
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Exibição do Próximo Slide (Next Up)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => updateStageConfig({ nextSlideDisplay: "first-line" })}
                    className={`flex flex-col rounded border p-2 text-left transition-all cursor-pointer ${
                      nextSlideDisplay === "first-line"
                        ? "border-sky-500 bg-sky-500/10 text-sky-300 font-semibold"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span>Apenas 1ª Frase</span>
                    <span className="text-[10px] font-normal opacity-70">
                      Visão concisa de 1 linha
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStageConfig({ nextSlideDisplay: "full" })}
                    className={`flex flex-col rounded border p-2 text-left transition-all cursor-pointer ${
                      nextSlideDisplay === "full"
                        ? "border-sky-500 bg-sky-500/10 text-sky-300 font-semibold"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span>Slide Inteiro</span>
                    <span className="text-[10px] font-normal opacity-70">
                      Todas as linhas do próximo
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stage Mini Preview */}
            <div className="space-y-2 lg:col-span-5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    Prévia do Retorno de Palco
                  </span>
                  <Badge variant="outline" className="h-4 text-[9px] font-mono border-zinc-800 text-zinc-400">
                    16:9
                  </Badge>
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded border border-zinc-800 bg-black shadow-inner">
                  <StageMiniPreview outputId={output.id} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
