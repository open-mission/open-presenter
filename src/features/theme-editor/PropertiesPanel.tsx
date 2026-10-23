import { useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  ChevronDown,
  Circle,
  Clock,
  Code,
  Eye,
  EyeOff,
  Film,
  FolderMinus,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Lock,
  Move,
  Palette,
  Scaling,
  Sliders,
  Sparkles,
  Square,
  Star,
  Triangle,
  Type,
  Unlock,
  WrapText,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SlideTheme, ThemeElement, ThemeElementType } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveThemeMedia } from "@/core/ipc/commands";
import { resolveCssMediaUrls } from "./media";
import { VARIABLE_KEYS } from "@/features/slide-themes/samples";
import { getActivePage, materializePage } from "@/features/slide-themes/pages";
import {
  LOGICAL_H,
  LOGICAL_W,
  elementBox,
  parseRotateDeg,
  toPct,
} from "./geometry";
import type { AlignEdge } from "./geometry";
import { selectionVisualBox } from "./selection";
import type { ReorderDirection } from "./elements";
import { useThemeEditorStore } from "./store";
import { FontPicker } from "./FontPicker";
import { SymbolsPicker } from "./SymbolsPicker";
import { CssCodeEditor } from "./CssCodeEditor";
import { GradientBuilder } from "./GradientBuilder";
import { ShaderCanvas } from "@/features/media-shaders/ShaderCanvas";
import { isIsfBackground } from "@/features/media-shaders/isfEngine";
import { ISFShaderControls } from "@/features/media-shaders/ISFShaderControls";
import { cn } from "@/core/lib/utils";
import {
  generateNoiseDataUrl,
  NOISE_PRESETS,
  applyNoiseToBackground,
  removeNoiseFromBackground,
  hasNoiseLayer,
} from "@/features/slide-themes/noiseGenerator";

const FONT_WEIGHTS = [
  { label: "Normal", value: "400" },
  { label: "Médio", value: "500" },
  { label: "Seminegrito", value: "600" },
  { label: "Negrito", value: "700" },
  { label: "Extra-negrito", value: "800" },
];

const ALL_VARIABLES = [...new Set(Object.values(VARIABLE_KEYS).flat())].sort();

const ALIGN_BUTTONS: { title: string; edge: AlignEdge; icon: LucideIcon }[] = [
  { title: "Alinhar à esquerda", edge: "left", icon: AlignHorizontalJustifyStart },
  { title: "Centralizar", edge: "centerX", icon: AlignHorizontalJustifyCenter },
  { title: "Alinhar à direita", edge: "right", icon: AlignHorizontalJustifyEnd },
  { title: "Alinhar ao topo", edge: "top", icon: AlignVerticalJustifyStart },
  { title: "Alinhar ao meio", edge: "middle", icon: AlignVerticalJustifyCenter },
  { title: "Alinhar à base", edge: "bottom", icon: AlignVerticalJustifyEnd },
];

const ORDER_BUTTONS: {
  label: string;
  direction: ReorderDirection;
  icon: LucideIcon;
}[] = [
  { label: "Trazer para frente", direction: "front", icon: ArrowUp },
  { label: "Avançar", direction: "forward", icon: ArrowRight },
  { label: "Recuar", direction: "backward", icon: ArrowLeft },
  { label: "Enviar para trás", direction: "back", icon: ArrowDown },
];

const CASE_BUTTONS = [
  { label: "Aa", value: "none", title: "Normal" },
  { label: "AA", value: "uppercase", title: "Maiúsculas" },
  { label: "aa", value: "lowercase", title: "Minúsculas" },
  { label: "Ab", value: "capitalize", title: "Capitalizar" },
];

const H_ALIGN_BUTTONS = [
  { label: "Esquerda", value: "left", icon: AlignLeft },
  { label: "Centro", value: "center", icon: AlignCenter },
  { label: "Direita", value: "right", icon: AlignRight },
  { label: "Justificado", value: "justify", icon: AlignJustify },
];

const V_ALIGN_BUTTONS = [
  { label: "Topo", value: "flex-start", icon: AlignVerticalJustifyStart },
  { label: "Meio", value: "center", icon: AlignVerticalJustifyCenter },
  { label: "Fundo", value: "flex-end", icon: AlignVerticalJustifyEnd },
];

const TEXT_EFFECTS = [
  { label: "Nenhum", value: "" },
  { label: "Sombra Suave", value: "2px 2px 4px rgba(0, 0, 0, 0.7)" },
  { label: "Sombra Forte", value: "3px 4px 8px rgba(0, 0, 0, 0.9)" },
  {
    label: "Contorno",
    value: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
  },
  { label: "Brilho", value: "0 0 16px rgba(255, 255, 255, 0.8)" },
];



function pxOf(value: string | undefined): number {
  if (!value) return 0;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|%)?$/);
  return match ? Number(match[1]) : 0;
}

type FitModeValue = "fixed" | "shrink" | "fit";

function fitModeOf(css: Record<string, string | undefined>): FitModeValue {
  if (css.fitMode === "fixed" || css.fitMode === "shrink" || css.fitMode === "fit") {
    return css.fitMode;
  }
  if (css.autoFit === "true") return "fit";
  if (css.autoShrink === "false") return "fixed";
  return "shrink";
}

function asHex(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  const short = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (short) return `#${short[1].split("").map((c) => c + c).join("")}`;
  return fallback;
}

function scalePctOf(transform: string | undefined): number {
  const match = (transform ?? "").match(/scale\(\s*([\d.]+)\s*\)/);
  if (!match) return 100;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 100;
}

type UpdateElement = (id: string, patch: Partial<ThemeElement>) => void;

function Section({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col rounded-lg border border-border/70 bg-card/40 transition-colors shadow-2xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors rounded-lg cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-primary" />}
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && <div className="p-3 pt-0 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-muted-foreground truncate">{label}</span>
      {children}
    </label>
  );
}

function SlideSettingsSection({
  draft,
}: {
  draft: SlideTheme;
  updateCss: (patch: Record<string, string>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Section title="CONFIGURAÇÕES DO SLIDE" icon={Sliders}>
        <Field label="Título do Tema / Apresentação">
          <Input
            value={draft.title}
            disabled
            className="h-8 text-xs font-mono"
          />
        </Field>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Categoria</span>
          <span className="font-semibold text-foreground uppercase">{draft.category ?? "theme"}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Elementos no Slide</span>
          <span className="font-mono text-foreground">{draft.elements.length}</span>
        </div>
      </Section>
    </div>
  );
}

function TextBoxBackgroundSection({
  el,
  updateElement,
  guid,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
  guid: string;
}) {
  const currentBg = el.css.background || el.css.backgroundColor || el.fill || "transparent";
  const isTransparent = currentBg === "transparent" || !currentBg;
  const isGradient = currentBg.includes("gradient");
  const isImage = currentBg.includes("url(");
  const isShader = isIsfBackground(currentBg);

  const [activeTab, setActiveTab] = useState<"none" | "solid" | "gradient" | "image" | "shader">(() =>
    isShader ? "shader" : isImage ? "image" : isGradient ? "gradient" : isTransparent ? "none" : "solid",
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentSize = el.css.backgroundSize || "cover";
  const currentPos = el.css.backgroundPosition || "center";
  const currentRepeat = el.css.backgroundRepeat || "no-repeat";
  const currentPadding = el.css.padding || "0px";

  async function handleImageFile(file: File) {
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const saved = await saveThemeMedia(guid, file.name, Array.from(bytes));
      updateElement(el.id, {
        css: {
          ...el.css,
          background: `url(${saved})`,
          backgroundSize: currentSize,
          backgroundPosition: currentPos,
          backgroundRepeat: currentRepeat,
        },
      });
    } catch (e) {
      console.error("Falha ao salvar imagem de fundo da caixa de texto", e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Section title="PLANO DE FUNDO DA CAIXA" icon={Palette}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "none" | "solid" | "gradient" | "image" | "shader");
          if (v === "none") {
            const nextCss = { ...el.css };
            delete nextCss.background;
            delete nextCss.backgroundColor;
            delete nextCss.backgroundImage;
            updateElement(el.id, { css: nextCss, fill: undefined });
          }
        }}
        className="w-full"
      >
        <TabsList className="grid grid-cols-5 h-8 p-0.5">
          <TabsTrigger value="none" className="text-[10px]">Nenhum</TabsTrigger>
          <TabsTrigger value="solid" className="text-[10px]">Cor</TabsTrigger>
          <TabsTrigger value="gradient" className="text-[10px]">Gradiente</TabsTrigger>
          <TabsTrigger value="image" className="text-[10px]">Imagem</TabsTrigger>
          <TabsTrigger value="shader" className="text-[10px]">Shader</TabsTrigger>
        </TabsList>

        <TabsContent value="none" className="pt-2">
          <p className="text-xs text-muted-foreground">Fundo transparente.</p>
        </TabsContent>

        <TabsContent value="solid" className="pt-2 flex flex-col gap-2.5">
          <Field label="Cor de Fundo da Caixa">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={asHex(currentBg, "#000000")}
                onChange={(e) =>
                  updateElement(el.id, {
                    css: { ...el.css, background: e.target.value },
                    fill: e.target.value,
                  })
                }
                className="size-8 rounded border border-border cursor-pointer p-0 shrink-0"
              />
              <Input
                value={currentBg}
                onChange={(e) =>
                  updateElement(el.id, {
                    css: { ...el.css, background: e.target.value },
                    fill: e.target.value,
                  })
                }
                className="h-8 font-mono text-xs"
                placeholder="#000000 ou rgba(0,0,0,0.5)"
              />
            </div>
          </Field>
        </TabsContent>

        <TabsContent value="gradient" className="pt-2">
          <GradientBuilder
            value={isGradient ? currentBg : "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"}
            onChange={(val) =>
              updateElement(el.id, {
                css: { ...el.css, background: val },
                fill: val,
              })
            }
          />
        </TabsContent>

        <TabsContent value="image" className="pt-2 flex flex-col gap-2.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageFile(file);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="h-8 text-xs gap-1.5 flex-1 cursor-pointer"
            >
              <ImageIcon className="size-3.5" />
              {uploading ? "Enviando..." : "Escolher Imagem de Fundo"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Field label="Ajuste (Tamanho)">
              <Select
                value={currentSize}
                onValueChange={(val) =>
                  updateElement(el.id, {
                    css: { ...el.css, backgroundSize: val },
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Preencher (Cover)</SelectItem>
                  <SelectItem value="contain">Ajustar (Contain)</SelectItem>
                  <SelectItem value="auto">Original (Auto)</SelectItem>
                  <SelectItem value="100% 100%">Esticar (100%)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Posição">
              <Select
                value={currentPos}
                onValueChange={(val) =>
                  updateElement(el.id, {
                    css: { ...el.css, backgroundPosition: val },
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="top">Superior</SelectItem>
                  <SelectItem value="bottom">Inferior</SelectItem>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="shader" className="pt-2 flex flex-col gap-2">
          <Field label="Shader ISF / Efeito">
            <Input
              value={isShader ? currentBg : ""}
              placeholder="isf:nome-do-shader ou generator"
              onChange={(e) =>
                updateElement(el.id, {
                  css: { ...el.css, background: e.target.value },
                })
              }
              className="h-8 font-mono text-xs"
            />
          </Field>
        </TabsContent>
      </Tabs>

      {/* Espaçamento interno (Padding) */}
      <div className="pt-2 border-t border-border/40 flex flex-col gap-1.5">
        <Field label="Espaçamento Interno (Padding)">
          <div className="flex items-center gap-1.5">
            <Input
              value={currentPadding}
              onChange={(e) =>
                updateElement(el.id, {
                  css: { ...el.css, padding: e.target.value },
                })
              }
              placeholder="ex: 16px ou 12px 24px"
              className="h-8 font-mono text-xs"
            />
            <div className="flex gap-1">
              {["0px", "8px", "16px", "24px"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    updateElement(el.id, {
                      css: { ...el.css, padding: p },
                    })
                  }
                  className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-card/60 hover:bg-muted font-mono cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Field>
      </div>
    </Section>
  );
}

export function PropertiesPanel() {
  const draft = useThemeEditorStore((s) => s.draft);
  const activePageId = useThemeEditorStore((s) => s.activePageId);
  const updateCss = useThemeEditorStore((s) => s.updateCss);
  const updateElement = useThemeEditorStore((s) => s.updateElement);
  const selection = useThemeEditorStore((s) => s.selection);

  if (!draft) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum tema carregado.</p>
    );
  }

  const page = getActivePage(draft, activePageId);
  const viewTheme = page ? materializePage(draft, page) : draft;
  const members = viewTheme.elements.filter((el) =>
    selection.ids.includes(el.id),
  );
  const selected =
    members.find((el) => el.id === selection.anchorId) ?? members[0] ?? null;
  const scope = members.length > 1 ? "selection" : "item";

  if (!selected) {
    return (
      <Tabs defaultValue="background" className="w-full flex flex-col">
        <TabsList className="grid grid-cols-2 h-9 p-1 bg-muted/60 mb-2">
          <TabsTrigger value="background" className="text-xs gap-1.5 cursor-pointer">
            <Palette className="size-3.5" />
            Fundo do Slide
          </TabsTrigger>
          <TabsTrigger value="slide" className="text-xs gap-1.5 cursor-pointer">
            <Sliders className="size-3.5" />
            Slide & Tela
          </TabsTrigger>
        </TabsList>

        <TabsContent value="background" className="space-y-3">
          <ThemeBackground draft={viewTheme} updateCss={updateCss} />
        </TabsContent>

        <TabsContent value="slide" className="space-y-3">
          <SlideSettingsSection draft={viewTheme} updateCss={updateCss} />
        </TabsContent>
      </Tabs>
    );
  }

  const isText = selected.type === "TEXT";
  const isMedia = selected.type === "IMAGE" || selected.type === "VIDEO";
  const isShape =
    selected.type === "RECTANGLE" ||
    selected.type === "CIRCLE" ||
    selected.type === "TRIANGLE" ||
    selected.type === "STAR";

  const organize = (
    <div className="space-y-3">
      <GeometrySection
        scope={scope}
        el={scope === "item" ? selected : null}
        elements={viewTheme.elements}
      />
      <AlignDistributeSection />
      <OrderSection />
      <GroupSection selected={selected} />
      {scope === "item" && (
        <GeneralSection selected={selected} updateElement={updateElement} />
      )}
    </div>
  );

  if (scope === "selection") {
    return <div className="flex flex-col gap-2">{organize}</div>;
  }

  const appearance = (
    <div className="space-y-3">
      {isText && (
        <TextBoxBackgroundSection
          el={selected}
          updateElement={updateElement}
          guid={draft.guid}
        />
      )}
      {isShape && (
        <RectangleSection el={selected} updateElement={updateElement} />
      )}
      <AppearanceSection el={selected} updateElement={updateElement} />
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <Tabs
        key={`${selected.type}-${scope}`}
        defaultValue={isText ? "text" : isMedia ? "media" : "organize"}
        className="w-full flex flex-col"
      >
        <TabsList
          className={cn(
            "grid h-9 p-1 bg-muted/60 mb-2",
            isText || isMedia ? "grid-cols-5" : "grid-cols-4",
          )}
        >
          {isText && (
            <TabsTrigger value="text" className="text-[10px] gap-1 cursor-pointer">
              <Type className="size-3.5" />
              Texto
            </TabsTrigger>
          )}
          {isMedia && (
            <TabsTrigger value="media" className="text-[10px] gap-1 cursor-pointer">
              <ImageIcon className="size-3.5" />
              Mídia
            </TabsTrigger>
          )}
          <TabsTrigger value="organize" className="text-[10px] gap-1 cursor-pointer">
            <Move className="size-3.5" />
            Organizar
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-[10px] gap-1 cursor-pointer">
            <Palette className="size-3.5" />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="transitions" className="text-[10px] gap-1 cursor-pointer">
            <Sparkles className="size-3.5" />
            Animação
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-[10px] gap-1 cursor-pointer">
            <Code className="size-3.5" />
            CSS
          </TabsTrigger>
        </TabsList>

        {isText && (
          <TabsContent value="text" className="space-y-3">
            <TextSection el={selected} updateElement={updateElement} />
          </TabsContent>
        )}

        {isMedia && (
          <TabsContent value="media" className="space-y-3">
            <ElementMediaSection
              guid={draft.guid}
              el={selected}
              updateElement={updateElement}
            />
          </TabsContent>
        )}

        <TabsContent value="organize" className="space-y-3">
          {organize}
        </TabsContent>

        <TabsContent value="appearance" className="space-y-3">
          {appearance}
        </TabsContent>

        <TabsContent value="transitions" className="space-y-3">
          <TransitionsSection el={selected} updateElement={updateElement} />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-3">
          <AdvancedCssSection el={selected} updateElement={updateElement} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlignDistributeSection() {
  const selection = useThemeEditorStore((s) => s.selection);
  const alignSelection = useThemeEditorStore((s) => s.alignSelection);
  const distributeSelection = useThemeEditorStore((s) => s.distributeSelection);
  const disabled = selection.ids.length === 0;

  return (
    <Section title="ALINHAR & DISTRIBUIR" icon={AlignCenter}>
      <div className="grid grid-cols-6 gap-1">
        {ALIGN_BUTTONS.map(({ title, edge, icon: Icon }) => (
          <Button
            key={edge}
            type="button"
            variant="outline"
            size="sm"
            title={title}
            disabled={disabled}
            className="h-8 cursor-pointer p-0 hover:bg-muted"
            onClick={() => alignSelection(edge)}
          >
            <Icon className="size-3.5 text-foreground" />
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Distribuir horizontalmente"
          disabled={selection.ids.length < 3}
          className="h-8 cursor-pointer gap-1 text-[11px]"
          onClick={() => distributeSelection("x")}
        >
          <ArrowLeft className="size-3.5" />
          Distribuir H
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Distribuir verticalmente"
          disabled={selection.ids.length < 3}
          className="h-8 cursor-pointer gap-1 text-[11px]"
          onClick={() => distributeSelection("y")}
        >
          <ArrowDown className="size-3.5" />
          Distribuir V
        </Button>
      </div>
    </Section>
  );
}

function OrderSection() {
  const selection = useThemeEditorStore((s) => s.selection);
  const reorderSelection = useThemeEditorStore((s) => s.reorderSelection);

  return (
    <Section title="ORDEM" icon={Layers}>
      <div className="grid grid-cols-4 gap-1">
        {ORDER_BUTTONS.map(({ label, direction, icon: Icon }) => (
          <Button
            key={direction}
            type="button"
            variant="outline"
            size="sm"
            title={label}
            disabled={selection.ids.length === 0}
            className="h-8 cursor-pointer p-0"
            onClick={() => reorderSelection(direction)}
          >
            <Icon className="size-3.5" />
          </Button>
        ))}
      </div>
    </Section>
  );
}

function GroupSection({ selected }: { selected: ThemeElement }) {
  const selection = useThemeEditorStore((s) => s.selection);
  const groupSelection = useThemeEditorStore((s) => s.groupSelection);
  const ungroupSelection = useThemeEditorStore((s) => s.ungroupSelection);
  const renameGroup = useThemeEditorStore((s) => s.renameGroup);
  const groupId = selection.enteredGroupId ?? selected.groupId ?? null;

  return (
    <Section title="AGRUPAR" icon={FolderPlus}>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 cursor-pointer gap-1 text-xs"
          disabled={selection.ids.length < 2}
          onClick={() => groupSelection()}
        >
          <FolderPlus className="size-3.5" />
          Agrupar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 cursor-pointer gap-1 text-xs"
          disabled={!groupId}
          onClick={() => ungroupSelection()}
        >
          <FolderMinus className="size-3.5" />
          Desagrupar
        </Button>
      </div>
      {groupId && (
        <Field label="Nome do grupo">
          <Input
            key={groupId}
            defaultValue={selected.groupName ?? "Grupo"}
            className="h-8 text-xs"
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name) renameGroup(groupId, name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </Field>
      )}
    </Section>
  );
}

function GeneralSection({
  selected,
  updateElement,
}: {
  selected: ThemeElement;
  updateElement: UpdateElement;
}) {
  return (
    <Section title="ELEMENTO" icon={Layers}>
      <Field label="Identificador">
        <Input value={selected.id} disabled aria-label="Nome do elemento" className="h-8 font-mono text-xs" />
      </Field>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">Visibilidade e Trava</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={selected.visible ? "secondary" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
            onClick={() => updateElement(selected.id, { visible: !selected.visible })}
          >
            {selected.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
            {selected.visible ? "Visível" : "Oculto"}
          </Button>
          <Button
            type="button"
            variant={selected.locked ? "destructive" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
            onClick={() => updateElement(selected.id, { locked: !selected.locked })}
          >
            {selected.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5 text-muted-foreground" />}
            {selected.locked ? "Bloqueado" : "Livre"}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function GeometrySection({
  scope,
  el,
  elements,
}: {
  scope: "item" | "selection";
  el: ThemeElement | null;
  elements: ThemeElement[];
}) {
  const selection = useThemeEditorStore((s) => s.selection);
  const updateElement = useThemeEditorStore((s) => s.updateElement);
  const translateSelection = useThemeEditorStore((s) => s.translateSelection);
  const scaleSelection = useThemeEditorStore((s) => s.scaleSelection);
  const setSelectionRotation = useThemeEditorStore(
    (s) => s.setSelectionRotation,
  );
  const rotateSelectionBy = useThemeEditorStore((s) => s.rotateSelectionBy);
  const [rotationDelta, setRotationDelta] = useState("");

  const box =
    scope === "item" && el
      ? elementBox(el)
      : selectionVisualBox(elements, selection.ids);
  if (!box) return null;

  function setPos(axis: "left" | "top", value: string) {
    if (!el || !box) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const left = axis === "left" ? Math.round(num) : Math.round(box.left);
    const top = axis === "top" ? Math.round(num) : Math.round(box.top);
    updateElement(el.id, {
      x: toPct(left, LOGICAL_W),
      y: toPct(top, LOGICAL_H),
      css: { ...el.css, left: `${left}px`, top: `${top}px` },
    });
  }

  function setDim(axis: "width" | "height", value: string) {
    if (!el) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    updateElement(el.id, {
      css: { ...el.css, [axis]: `${Math.round(num)}px` },
    });
  }

  function moveSelection(axis: "left" | "top", value: string) {
    if (!box) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    if (axis === "left") translateSelection(num - box.left, 0);
    else translateSelection(0, num - box.top);
  }

  function resizeSelection(axis: "width" | "height", value: string) {
    if (!box) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    if (axis === "width") scaleSelection(num / box.width, 1);
    else scaleSelection(1, num / box.height);
  }

  function setRotation(value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setSelectionRotation(Math.max(-180, Math.min(180, num)));
  }

  function applyRotationDelta() {
    const num = Number(rotationDelta);
    setRotationDelta("");
    if (!Number.isFinite(num) || num === 0) return;
    rotateSelectionBy(num);
  }

  function setScale(value: string) {
    if (!el) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    updateElement(el.id, {
      css: { ...el.css, transform: `scale(${num / 100})` },
    });
  }

  function setMargin(side: string, value: string) {
    if (!el) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    const css = { ...el.css };
    if (num === 0) {
      delete css[side];
    } else {
      css[side] = `${num}px`;
    }
    updateElement(el.id, { css });
  }

  return (
    <Section
      title={scope === "item" ? "GEOMETRIA" : "GEOMETRIA DA SELEÇÃO"}
      icon={Move}
    >
      <div className="flex flex-wrap gap-2">
        <Field label="X (px)" className="min-w-[110px] flex-1">
          <Input
            type="number"
            className="h-8 font-mono text-xs"
            value={Math.round(box.left)}
            onChange={(e) =>
              scope === "item"
                ? setPos("left", e.target.value)
                : moveSelection("left", e.target.value)
            }
          />
        </Field>
        <Field label="Y (px)" className="min-w-[110px] flex-1">
          <Input
            type="number"
            className="h-8 font-mono text-xs"
            value={Math.round(box.top)}
            onChange={(e) =>
              scope === "item"
                ? setPos("top", e.target.value)
                : moveSelection("top", e.target.value)
            }
          />
        </Field>
        <Field label="Largura (px)" className="min-w-[110px] flex-1">
          <Input
            type="number"
            min={20}
            className="h-8 font-mono text-xs"
            value={Math.round(box.width)}
            onChange={(e) =>
              scope === "item"
                ? setDim("width", e.target.value)
                : resizeSelection("width", e.target.value)
            }
          />
        </Field>
        <Field label="Altura (px)" className="min-w-[110px] flex-1">
          <Input
            type="number"
            min={20}
            className="h-8 font-mono text-xs"
            value={Math.round(box.height)}
            onChange={(e) =>
              scope === "item"
                ? setDim("height", e.target.value)
                : resizeSelection("height", e.target.value)
            }
          />
        </Field>
        {scope === "item" ? (
          <Field label="Rotação (°)" className="min-w-[110px] flex-1">
            <Input
              type="number"
              min={-180}
              max={180}
              step={1}
              className="h-8 font-mono text-xs"
              value={Math.round(parseRotateDeg(el?.css.rotate))}
              onChange={(e) => setRotation(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Rotação (°)" className="min-w-[110px] flex-1">
            <Input
              type="number"
              step={1}
              placeholder="0"
              className="h-8 font-mono text-xs"
              value={rotationDelta}
              onChange={(e) => setRotationDelta(e.target.value)}
              onBlur={applyRotationDelta}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyRotationDelta();
                }
              }}
            />
          </Field>
        )}
      </div>

      {scope === "item" && el && (
        <>
          {/* Escala */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">
            Escala: {scalePctOf(el.css.transform)}%
          </span>
          <Input
            type="number"
            min={1}
            max={500}
            className="h-7 w-16 text-xs font-mono text-right px-1.5"
            value={scalePctOf(el.css.transform)}
            onChange={(e) => setScale(e.target.value)}
          />
        </div>
        <input
          type="range"
          min={10}
          max={200}
          value={scalePctOf(el.css.transform)}
          onChange={(e) => setScale(e.target.value)}
          className="h-2 w-full accent-primary cursor-pointer"
        />
      </div>

      {/* Margens Internas (Padding) - Resolvendo problema de inputs espremidos */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
        <span className="text-[11px] font-medium text-foreground">
          Margens Internas / Padding
        </span>
        <div className="flex flex-wrap gap-2">
          <Field label="Topo (px)" className="min-w-[110px] flex-1">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingTop)}
              onChange={(e) => setMargin("paddingTop", e.target.value)}
            />
          </Field>
          <Field label="Direita (px)" className="min-w-[110px] flex-1">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingRight)}
              onChange={(e) => setMargin("paddingRight", e.target.value)}
            />
          </Field>
          <Field label="Fundo (px)" className="min-w-[110px] flex-1">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingBottom)}
              onChange={(e) => setMargin("paddingBottom", e.target.value)}
            />
          </Field>
          <Field label="Esquerda (px)" className="min-w-[110px] flex-1">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingLeft)}
              onChange={(e) => setMargin("paddingLeft", e.target.value)}
            />
          </Field>
        </div>
      </div>
        </>
      )}
    </Section>
  );
}

function TextSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function setCss(patch: Record<string, string>, remove: string[] = []) {
    const css = { ...el.css, ...patch };
    for (const k of remove) delete css[k];
    updateElement(el.id, { css });
  }

  const fitMode = fitModeOf(el.css);
  const baseFont = pxOf(el.css.fontSize) || 48;
  const defaultMaxFont = Math.round(baseFont * 2.5);

  function insertVariable(key: string) {
    const tag = `{${key}}`;
    const area = areaRef.current;
    if (!area) {
      updateElement(el.id, { text: `${el.text ?? ""}${tag}` });
      return;
    }
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? area.value.length;
    const text = area.value;
    const next = `${text.slice(0, start)}${tag}${text.slice(end)}`;
    updateElement(el.id, { text: next });
    requestAnimationFrame(() => {
      area.focus();
      const pos = start + tag.length;
      area.setSelectionRange(pos, pos);
    });
  }

  function insertSymbol(sym: string) {
    const area = areaRef.current;
    if (!area) {
      updateElement(el.id, { text: `${el.text ?? ""}${sym}` });
      return;
    }
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? area.value.length;
    const text = area.value;
    const next = `${text.slice(0, start)}${sym}${text.slice(end)}`;
    updateElement(el.id, { text: next });
    requestAnimationFrame(() => {
      area.focus();
      const pos = start + sym.length;
      area.setSelectionRange(pos, pos);
    });
  }

  const hAlign = el.css.textAlign ?? "center";
  const rawV =
    el.css.justifyContent ||
    el.css.verticalAlign ||
    el.css.alignItems;
  const vAlign =
    rawV === "flex-end" || rawV === "end" || rawV === "bottom"
      ? "flex-end"
      : rawV === "flex-start" || rawV === "start" || rawV === "top"
      ? "flex-start"
      : "center";

  return (
    <Section title="TEXTO & TIPOGRAFIA" icon={Type}>
      <Textarea
        ref={areaRef}
        aria-label="Conteúdo do texto"
        rows={3}
        value={el.text ?? ""}
        onChange={(e) => updateElement(el.id, { text: e.target.value })}
        className="text-xs resize-none"
      />

      {/* Variáveis & Símbolos */}
      <div className="flex items-center gap-1.5">
        <Select value="" onValueChange={(key) => insertVariable(key)}>
          <SelectTrigger className="flex-1 h-8 text-xs" aria-label="Inserir variável">
            <SelectValue placeholder="{·} Variável em inglês" />
          </SelectTrigger>
          <SelectContent position="popper">
            {ALL_VARIABLES.map((key) => (
              <SelectItem key={key} value={key} className="text-xs font-mono">
                {`{${key}}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SymbolsPicker onInsert={insertSymbol} />
      </div>

      {/* Badges rápidos de variáveis em inglês */}
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        {[
          { label: "clock", key: "clock" },
          { label: "stopwatch", key: "stopwatch" },
          { label: "timer", key: "timer" },
          { label: "lyrics", key: "lyrics" },
          { label: "reference", key: "reference" },
          { label: "version", key: "version" },
          { label: "reference_abbr", key: "reference_abbr" },
          { label: "next_verse", key: "next_verse" },
          { label: "next_preview", key: "next_preview" },
          { label: "stage_message", key: "stage_message" },
          { label: "aviso", key: "aviso" },
          { label: "title", key: "title" },
        ].map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            className="rounded border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title={`Inserir {${v.key}}`}
          >
            {`{${v.key}}`}
          </button>
        ))}
      </div>

      {/* Fonte Pesquisável */}
      <div className="flex flex-col gap-1 pt-1 border-t border-border/40">
        <span className="text-[11px] font-medium text-foreground">
          Família da Fonte
        </span>
        <FontPicker
          value={el.css.fontFamily ?? "Arial"}
          onChange={(font) => setCss({ fontFamily: font })}
        />
      </div>

      {/* Tamanho, Peso e Linha com flex-wrap e min-w */}
      <div className="flex flex-wrap gap-2">
        <Field label="Tam. (px)" className="min-w-[75px] flex-1">
          <Input
            type="number"
            min={1}
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.fontSize)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (Number.isFinite(num) && num > 0) setCss({ fontSize: `${num}px` });
            }}
          />
        </Field>
        <Field label="Peso" className="min-w-[125px] flex-1">
          <Select
            value={el.css.fontWeight ?? "400"}
            onValueChange={(value) => setCss({ fontWeight: value })}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w.value} value={w.value} className="text-xs">
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Linha" className="min-w-[75px] flex-1">
          <Input
            className="h-8 font-mono text-xs"
            value={el.css.lineHeight ?? "1.2"}
            onChange={(e) => setCss({ lineHeight: e.target.value })}
          />
        </Field>
      </div>

      {/* Alinhamento Horizontal e Vertical com Ícones */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-medium text-foreground shrink-0">
            Alinhamento do Texto
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30 shrink-0">
            {H_ALIGN_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const selected = hAlign === btn.value;
              return (
                <button
                  key={btn.value}
                  type="button"
                  title={btn.label}
                  onClick={() => setCss({ textAlign: btn.value })}
                  className={cn(
                    "flex size-7 items-center justify-center rounded transition-colors cursor-pointer",
                    selected
                      ? "bg-background text-primary shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-medium text-foreground shrink-0">
            Alinhamento Vertical
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30 shrink-0">
            {V_ALIGN_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const selected = vAlign === btn.value;
              return (
                <button
                  key={btn.value}
                  type="button"
                  title={btn.label}
                  onClick={() =>
                    setCss(
                      {
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: btn.value,
                      },
                      ["alignItems"],
                    )
                  }
                  className={cn(
                    "flex size-7 items-center justify-center rounded transition-colors cursor-pointer",
                    selected
                      ? "bg-background text-primary shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-medium text-foreground shrink-0">
            Capitalização
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30 shrink-0">
            {CASE_BUTTONS.map((btn) => {
              const selected = (el.css.textTransform ?? "none") === btn.value;
              return (
                <button
                  key={btn.value}
                  type="button"
                  title={btn.title}
                  onClick={() => setCss({ textTransform: btn.value })}
                  className={cn(
                    "flex h-7 px-2 items-center justify-center rounded text-xs transition-colors cursor-pointer font-mono",
                    selected
                      ? "bg-background text-primary shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cor do Texto e Efeitos */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
        <Field label="Cor do Texto" className="min-w-[130px] flex-1">
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={asHex(el.css.color, "#ffffff")}
              onChange={(e) => setCss({ color: e.target.value })}
              className="size-8 rounded border border-border cursor-pointer p-0 shrink-0"
            />
            <Input
              value={el.css.color ?? "#ffffff"}
              onChange={(e) => setCss({ color: e.target.value })}
              className="h-8 font-mono text-xs"
            />
          </div>
        </Field>
        <Field label="Efeito" className="min-w-[130px] flex-1">
          <Select
            value={el.css.textShadow ?? ""}
            onValueChange={(val) => setCss({ textShadow: val })}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent position="popper">
              {TEXT_EFFECTS.map((ef) => (
                <SelectItem key={ef.label} value={ef.value} className="text-xs">
                  {ef.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Quebra de Linha e Auto-size da Fonte */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
        {/* Quebra de Linha */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <WrapText className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground shrink-0">
              Quebra de Texto
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30 shrink-0">
            <button
              type="button"
              title="Quebrar texto automaticamente em múltiplas linhas"
              onClick={() =>
                setCss({
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                })
              }
              className={cn(
                "flex h-7 px-2 items-center gap-1.5 justify-center rounded text-xs transition-colors cursor-pointer",
                (el.css.whiteSpace ?? "pre-wrap") !== "nowrap"
                  ? "bg-background text-primary shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <WrapText className="size-3" />
              <span>Quebrar</span>
            </button>
            <button
              type="button"
              title="Manter em linha única (sem quebra automática)"
              onClick={() =>
                setCss({
                  whiteSpace: "nowrap",
                  wordBreak: "normal",
                })
              }
              className={cn(
                "flex h-7 px-2 items-center gap-1.5 justify-center rounded text-xs transition-colors cursor-pointer",
                el.css.whiteSpace === "nowrap"
                  ? "bg-background text-primary shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Linha única</span>
            </button>
          </div>
        </div>

        {/* Ajuste de Fonte / Auto-size */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <Scaling className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-foreground shrink-0">
                Auto-size (Fazer caber)
              </span>
            </div>
            <Select
              value={fitMode}
              onValueChange={(val) => {
                const mode = val as FitModeValue;
                setCss({
                  fitMode: mode,
                  autoShrink: mode === "fixed" ? "false" : "true",
                  autoFit: mode === "fit" ? "true" : "false",
                });
              }}
            >
              <SelectTrigger className="w-[160px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="fixed" className="text-xs">
                  Fixo (Desativado)
                </SelectItem>
                <SelectItem value="shrink" className="text-xs">
                  Reduzir para caber
                </SelectItem>
                <SelectItem value="fit" className="text-xs">
                  Preencher caixa (Auto-fit)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="pl-5 text-[10px] text-muted-foreground">
            {fitMode === "shrink" && "O tamanho base é o máximo; o texto só diminui."}
            {fitMode === "fit" && "O texto cresce somente até o tamanho máximo."}
            {fitMode === "fixed" && "O tamanho base é aplicado sem ajuste."}
          </p>

          {fitMode !== "fixed" && (
            <div className="flex flex-col gap-1 pl-5 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Tam. mínimo da fonte (px)
                </span>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  className="h-7 w-20 font-mono text-xs text-right"
                  placeholder="16"
                  value={pxOf(el.css.minFontSize) || 16}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    if (Number.isFinite(num) && num > 0) {
                      setCss({ minFontSize: `${num}px` });
                    }
                  }}
                />
              </div>

              {fitMode === "fit" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Tam. máximo da fonte (px)
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    className="h-7 w-20 font-mono text-xs text-right"
                    placeholder={String(defaultMaxFont)}
                    value={pxOf(el.css.maxFontSize) || defaultMaxFont}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      if (Number.isFinite(num) && num > 0) {
                        setCss({ maxFontSize: `${num}px` });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Piscar dois pontos (:) para relógio/timer */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/40">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-foreground">
              Piscar dois pontos (:)
            </span>
            <span className="text-[10px] text-muted-foreground">
              Animação no relógio / timer (: piscando)
            </span>
          </div>
          <Switch
            checked={
              el.css.blinkColon === "true" ||
              (Boolean(el.text?.includes("{clock}")) && el.css.blinkColon !== "false")
            }
            onCheckedChange={(checked) =>
              setCss({ blinkColon: checked ? "true" : "false" })
            }
          />
        </div>
      </div>
    </Section>
  );
}

const RECTANGLE_GRADIENT_PRESETS = [
  {
    name: "Fade p/ Direita (Lower Third)",
    value: "linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.7) 65%, transparent 100%)",
  },
  {
    name: "Fade p/ Esquerda",
    value: "linear-gradient(270deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.7) 65%, transparent 100%)",
  },
  {
    name: "Fade Inferior (Cima p/ Baixo)",
    value: "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.88) 100%)",
  },
  {
    name: "Fade Superior (Baixo p/ Cima)",
    value: "linear-gradient(0deg, transparent 0%, rgba(0, 0, 0, 0.88) 100%)",
  },
  {
    name: "Vidro Fosco Glass",
    value: "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 100%)",
  },
  {
    name: "Azul Noturno",
    value: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
  },
  {
    name: "Dourado Nobre",
    value: "linear-gradient(135deg, #b45309 0%, #78350f 100%)",
  },
  {
    name: "Carmesim / Vinho",
    value: "linear-gradient(135deg, #881337 0%, #4c0519 100%)",
  },
  {
    name: "Esmeralda",
    value: "linear-gradient(135deg, #065f46 0%, #022c22 100%)",
  },
  {
    name: "Púrpura Profundo",
    value: "linear-gradient(135deg, #581c87 0%, #1e1b4b 100%)",
  },
];

const RECTANGLE_COLOR_PRESETS = [
  { name: "Transparente", value: "transparent" },
  { name: "Slate 90%", value: "rgba(15, 23, 42, 0.9)" },
  { name: "Preto 80%", value: "rgba(0, 0, 0, 0.8)" },
  { name: "Vidro 15%", value: "rgba(255, 255, 255, 0.15)" },
  { name: "Azul", value: "#38bdf8" },
  { name: "Dourado", value: "#fbbf24" },
  { name: "Carmesim", value: "#f43f5e" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Roxo", value: "#a855f7" },
];

function RectangleSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const shapeInfo: Partial<Record<ThemeElementType, { title: string; icon: LucideIcon }>> = {
    RECTANGLE: { title: "PREENCHIMENTO DO RETÂNGULO", icon: Square },
    CIRCLE: { title: "PREENCHIMENTO DO CÍRCULO", icon: Circle },
    TRIANGLE: { title: "PREENCHIMENTO DO TRIÂNGULO", icon: Triangle },
    STAR: { title: "PREENCHIMENTO DA ESTRELA", icon: Star },
  };
  const currentShape = shapeInfo[el.type] ?? { title: "PREENCHIMENTO DA FORMA", icon: Square };
  const ShapeIcon = currentShape.icon;

  const currentFill = el.fill ?? "#1e3a8a";
  const isGradient = currentFill.includes("gradient");
  const isNoise = hasNoiseLayer(currentFill);

  const [activeTab, setActiveTab] = useState<"solid" | "gradient" | "noise">(() =>
    isGradient ? "gradient" : isNoise ? "noise" : "solid",
  );

  const [noiseOpacity, setNoiseOpacity] = useState(0.2);
  const [noiseGrain, setNoiseGrain] = useState<1 | 2 | 3>(1);

  function applyPreset(val: string) {
    updateElement(el.id, { fill: val });
  }

  function handleNoiseGenerate(mode: "replace" | "overlay") {
    const noise = generateNoiseDataUrl({
      opacity: noiseOpacity,
      grainSize: noiseGrain,
    });
    if (mode === "overlay") {
      updateElement(el.id, {
        fill: applyNoiseToBackground(currentFill, noise),
      });
    } else {
      updateElement(el.id, { fill: noise });
    }
  }

  function handleRemoveNoise() {
    updateElement(el.id, {
      fill: removeNoiseFromBackground(currentFill) || "#1e3a8a",
    });
  }

  return (
    <Section title={currentShape.title} icon={ShapeIcon}>
      {/* Mini preview do preenchimento */}
      <div
        className="h-10 w-full rounded-lg border border-border shadow-inner overflow-hidden flex items-center justify-center text-[10px] font-mono text-muted-foreground/70"
        style={{
          background: currentFill,
        }}
      >
        {currentFill.length > 30 ? `${currentFill.slice(0, 30)}…` : currentFill}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "solid" | "gradient" | "noise")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 h-8 p-0.5">
          <TabsTrigger value="solid" className="text-[10px]">
            Cor
          </TabsTrigger>
          <TabsTrigger value="gradient" className="text-[10px]">
            Gradiente
          </TabsTrigger>
          <TabsTrigger value="noise" className="text-[10px]">
            Noise
          </TabsTrigger>
        </TabsList>

        {/* Aba Cor Sólida */}
        <TabsContent value="solid" className="pt-2 flex flex-col gap-2.5">
          <Field label="Cor de Preenchimento">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={asHex(currentFill, "#1e3a8a")}
                onChange={(e) => updateElement(el.id, { fill: e.target.value })}
                className="size-8 rounded border border-border cursor-pointer p-0 shrink-0"
              />
              <Input
                value={currentFill}
                onChange={(e) => updateElement(el.id, { fill: e.target.value })}
                className="h-8 font-mono text-xs"
                placeholder="#1e3a8a ou rgba(...)"
              />
            </div>
          </Field>

          {/* Chips de cores rápidas */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground font-medium">
              Cores Rápidas:
            </span>
            <div className="flex flex-wrap gap-1">
              {RECTANGLE_COLOR_PRESETS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => applyPreset(c.value)}
                  className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span
                    className="size-2 rounded-full border border-black/20"
                    style={{ background: c.value }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Aba Gradiente */}
        <TabsContent value="gradient" className="pt-2 flex flex-col gap-3">
          {/* Presets de Gradientes Rápidos */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">
              Presets de Gradiente (Transparências e Barras):
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {RECTANGLE_GRADIENT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p.value)}
                  className="group relative flex h-7 items-center justify-start overflow-hidden rounded border border-border/80 px-2 text-[10px] font-medium text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
                  style={{ background: p.value }}
                >
                  <span className="relative z-10 truncate text-shadow-xs drop-shadow-sm font-semibold">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Construtor Visual de Gradiente */}
          <div className="border-t border-border/40 pt-2">
            <GradientBuilder
              value={isGradient ? currentFill : "linear-gradient(90deg, #1e3a8a 0%, #0f172a 100%)"}
              onChange={(newGradient) => updateElement(el.id, { fill: newGradient })}
            />
          </div>
        </TabsContent>

        {/* Aba Textura / Noise */}
        <TabsContent value="noise" className="pt-2 flex flex-col gap-2.5">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">
                Intensidade do Grão
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {Math.round(noiseOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.02}
              value={noiseOpacity}
              onChange={(e) => setNoiseOpacity(Number(e.target.value))}
              className="h-2 w-full accent-primary cursor-pointer"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-foreground">
                Granulação
              </span>
              <div className="flex items-center gap-1">
                {[
                  { label: "Fina", size: 1 as const },
                  { label: "Média", size: 2 as const },
                  { label: "Áspera", size: 3 as const },
                ].map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setNoiseGrain(g.size)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] border transition-colors cursor-pointer",
                      noiseGrain === g.size
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 hover:bg-muted text-muted-foreground",
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets Rápidos de Ruído */}
            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/40">
              {NOISE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (p.options.opacity) setNoiseOpacity(p.options.opacity);
                    if (p.options.grainSize) setNoiseGrain(p.options.grainSize as 1 | 2 | 3);
                    const n = generateNoiseDataUrl(p.options);
                    updateElement(el.id, {
                      fill: applyNoiseToBackground(currentFill, n),
                    });
                  }}
                  className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  title={p.desc}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleNoiseGenerate("overlay")}
                className="flex-1 h-7 text-[10px] gap-1 cursor-pointer"
              >
                <Sparkles className="size-3 text-amber-400" />
                Sobrepor ao Fundo Atual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleNoiseGenerate("replace")}
                className="h-7 text-[10px] px-2 cursor-pointer"
                title="Substituir todo o preenchimento apenas pela textura"
              >
                Apenas Textura
              </Button>
            </div>

            {isNoise && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveNoise}
                className="h-6 text-[10px] text-destructive hover:text-destructive cursor-pointer"
              >
                Remover Camada de Textura
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Section>
  );
}

function ElementMediaSection({
  guid,
  el,
  updateElement,
}: {
  guid: string;
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isVideo = el.type === "VIDEO";

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const saved = await saveThemeMedia(guid, file.name, Array.from(bytes));
      updateElement(el.id, { src: saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Section title={isVideo ? "VÍDEO" : "IMAGEM"} icon={isVideo ? Film : ImageIcon}>
      {(el.src ?? "") !== "" && (
        <p className="truncate px-1 font-mono text-[11px] text-muted-foreground" title={el.src}>
          {el.src}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={isVideo ? ".mp4" : ".png,.jpg,.jpeg,.webp"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? "Enviando…" : isVideo ? "Escolher Vídeo…" : "Escolher Imagem…"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Section>
  );
}

function AppearanceSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const opacityPct = Math.round(Number(el.css.opacity ?? "1") * 100);

  return (
    <Section title="APARÊNCIA & BORDAS" icon={Sliders} defaultOpen={false}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-foreground">
          Opacidade: {opacityPct}%
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={opacityPct}
          onChange={(e) => {
            const pct = Number(e.target.value);
            if (Number.isFinite(pct)) {
              updateElement(el.id, { css: { ...el.css, opacity: String(pct / 100) } });
            }
          }}
          className="h-2 w-full accent-primary cursor-pointer"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
        <Field label="Borda (px)" className="min-w-[110px] flex-1">
          <Input
            type="number"
            min={0}
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.borderWidth)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isFinite(num) || num < 0) return;
              const css = { ...el.css };
              if (num === 0) {
                delete css.borderWidth;
                delete css.borderStyle;
              } else {
                css.borderWidth = `${num}px`;
                css.borderStyle = "solid";
              }
              updateElement(el.id, { css });
            }}
          />
        </Field>
        <Field label="Arredondamento (px)" className="min-w-[110px] flex-1">
          <Input
            type="number"
            min={0}
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.borderRadius)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isFinite(num) || num < 0) return;
              updateElement(el.id, {
                css: { ...el.css, borderRadius: `${num}px` },
              });
            }}
          />
        </Field>
      </div>
    </Section>
  );
}

function TransitionsSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const isPersistent =
    el.css.isPersistent === "true" ||
    (el.css.isPersistent as unknown) === true;
  const rawType =
    el.css.transitionType ?? (el.type === "RECTANGLE" ? "none" : "fade");
  const transitionType = isPersistent ? "none" : rawType;
  const duration = el.css.transitionDuration ?? "250ms";

  function setTransition(type: string) {
    if (type === "none") {
      updateElement(el.id, {
        css: {
          ...el.css,
          transitionType: "none",
          isPersistent: "true",
        },
      });
    } else {
      updateElement(el.id, {
        css: {
          ...el.css,
          transitionType: type,
          isPersistent: "false",
        },
      });
    }
  }

  function setDuration(dur: string) {
    updateElement(el.id, {
      css: {
        ...el.css,
        transitionDuration: dur,
      },
    });
  }

  const TRANSITION_TYPES = [
    {
      value: "none",
      label: "Fixo",
      icon: Ban,
      title: "Nenhum / Fixo",
      desc: "Permanece estático na troca de slides",
    },
    {
      value: "fade",
      label: "Fade",
      icon: Sparkles,
      title: "Fade",
      desc: "Esmaecer suavemente no lugar",
    },
    {
      value: "fade-up",
      label: "Subir",
      icon: ArrowUp,
      title: "Fade para Cima",
      desc: "Entra subindo suavemente",
    },
    {
      value: "fade-down",
      label: "Descer",
      icon: ArrowDown,
      title: "Fade para Baixo",
      desc: "Entra descendo suavemente",
    },
    {
      value: "fade-left",
      label: "Esquerda",
      icon: ArrowLeft,
      title: "Fade para Esquerda",
      desc: "Entra da esquerda para a direita",
    },
    {
      value: "fade-right",
      label: "Direita",
      icon: ArrowRight,
      title: "Fade para Direita",
      desc: "Entra da direita para a esquerda",
    },
  ];

  const DURATION_PRESETS = [
    { value: "150ms", label: "150ms" },
    { value: "250ms", label: "250ms" },
    { value: "400ms", label: "400ms" },
    { value: "600ms", label: "600ms" },
  ];

  const activeTransition =
    TRANSITION_TYPES.find((t) => t.value === transitionType) ??
    TRANSITION_TYPES[1];

  return (
    <Section title="TRANSIÇÃO & ANIMAÇÃO" icon={Zap}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            Efeito ao Mudar Slide
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {activeTransition.title}
          </span>
        </div>

        {/* Grid de Efeitos */}
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border/70 p-1 bg-muted/20">
          {TRANSITION_TYPES.map((t) => {
            const Icon = t.icon;
            const selected = transitionType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                title={t.desc}
                onClick={() => setTransition(t.value)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                  selected
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate w-full text-center">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Descrição contextual */}
        <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/30 p-2 rounded border border-border/40">
          {transitionType === "none" ? (
            <>
              <strong>Camada Fixa / Persistente:</strong> este elemento permanece estável na tela e não pisca ao trocar os versos da música, textos ou versículos. Ideal para retângulos de fundo, tarjas e molduras.
            </>
          ) : (
            <>
              <strong>{activeTransition.title}:</strong> {activeTransition.desc}. Ao trocar de slide, o texto anterior sai com transição direcional suave.
            </>
          )}
        </p>

        {/* Seletor de Duração (visível quando animado) */}
        {transitionType !== "none" && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground" />
                Duração da Transição
              </span>
              <span className="text-[11px] font-mono text-primary font-medium">
                {duration}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {DURATION_PRESETS.map((p) => {
                const selected = duration === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setDuration(p.value)}
                    className={cn(
                      "py-1 px-1.5 text-xs rounded border transition-colors cursor-pointer text-center font-mono",
                      selected
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function AdvancedCssSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  return (
    <Section title="CSS AVANÇADO" icon={Sliders} defaultOpen={false}>
      <CssCodeEditor
        css={el.css}
        onChange={(newCss) => updateElement(el.id, { css: newCss })}
      />
    </Section>
  );
}

function ThemeBackground({
  draft,
  updateCss,
}: {
  draft: { guid: string; css: Record<string, string> };
  updateCss: (patch: Record<string, string>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const saved = await saveThemeMedia(draft.guid, file.name, Array.from(bytes));
      updateCss({ background: `url(${saved})` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  const currentBg = draft.css.background ?? "#000000";

  return (
    <div className="flex flex-col gap-4">
      <Section title="PLANO DE FUNDO DO TEMA" icon={Palette}>
        {/* Preview do Fundo */}
        <div
          className="h-20 w-full rounded-lg border border-border shadow-inner overflow-hidden relative"
          style={{
            background: isIsfBackground(currentBg)
              ? undefined
              : (resolveCssMediaUrls(draft.css.background) ?? "#000000"),
          }}
        >
          {isIsfBackground(currentBg) && (
            <ShaderCanvas shader={currentBg} />
          )}
        </div>

        {/* Abas de Tipos de Fundo */}
        <Tabs defaultValue={hasNoiseLayer(currentBg) ? "noise" : "gradient"} className="w-full">
          <TabsList className="grid grid-cols-5 h-8 p-0.5">
            <TabsTrigger value="gradient" className="text-[10px] px-1">Gradiente</TabsTrigger>
            <TabsTrigger value="solid" className="text-[10px] px-1">Cor</TabsTrigger>
            <TabsTrigger value="noise" className="text-[10px] px-1">Noise</TabsTrigger>
            <TabsTrigger value="shader" className="text-[10px] px-1">Shader</TabsTrigger>
            <TabsTrigger value="image" className="text-[10px] px-1">Mídia</TabsTrigger>
          </TabsList>

          {/* Aba Gradiente com Construtor Visual */}
          <TabsContent value="gradient" className="pt-2">
            <GradientBuilder
              value={currentBg}
              onChange={(newGradient) => updateCss({ background: newGradient })}
            />
          </TabsContent>

          {/* Aba Cor Sólida */}
          <TabsContent value="solid" className="pt-2 flex flex-col gap-2">
            <Field label="Cor Sólida">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={asHex(currentBg, "#000000")}
                  onChange={(e) => updateCss({ background: e.target.value })}
                  className="size-9 rounded border border-border cursor-pointer p-0 shrink-0"
                />
                <Input
                  value={currentBg}
                  onChange={(e) => updateCss({ background: e.target.value })}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </Field>
          </TabsContent>

          {/* Aba Textura de Ruído / Noise */}
          <TabsContent value="noise" className="pt-2 flex flex-col gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-400" />
                  Gerador de Textura & Grão
                </span>
                {hasNoiseLayer(currentBg) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                    Textura Ativa
                  </span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Aplica textura orgânica de filme/grão sobre gradientes e cores, eliminando faixas de banding e dando profundidade cinematográfica ao telão.
              </p>

              {/* Presets Rápidos de Textura */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Presets de Textura Cinematográfica:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {NOISE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const noise = generateNoiseDataUrl(p.options);
                        updateCss({ background: applyNoiseToBackground(currentBg, noise) });
                      }}
                      className="flex flex-col items-start gap-0.5 rounded border border-border/70 bg-card/60 p-2 text-left hover:border-primary/50 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold text-foreground">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">
                        {p.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const noise = generateNoiseDataUrl({ opacity: 0.18, grainSize: 1 });
                    updateCss({ background: applyNoiseToBackground(currentBg, noise) });
                  }}
                  className="gap-1.5 h-8 text-xs cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-amber-400" />
                  Aplicar Textura sobre Fundo Atual
                </Button>

                {hasNoiseLayer(currentBg) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updateCss({ background: removeNoiseFromBackground(currentBg) || "#000000" });
                    }}
                    className="h-7 text-xs text-destructive hover:text-destructive cursor-pointer"
                  >
                    Remover Textura do Fundo
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Aba Shaders / ISF Animados */}
          <TabsContent value="shader" className="pt-2 flex flex-col gap-2">
            <ISFShaderControls
              value={currentBg}
              onChange={(newBg) => updateCss({ background: newBg })}
            />
          </TabsContent>

          {/* Aba Imagem / Mídia */}
          <TabsContent value="image" className="pt-2 flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleFile(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              <ImageIcon className="size-3.5" />
              {uploading ? "Enviando imagem…" : "Carregar Imagem de Fundo"}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}
