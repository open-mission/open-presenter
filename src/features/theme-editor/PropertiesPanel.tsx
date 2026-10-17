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
  ChevronDown,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Layers,
  Lock,
  Move,
  Palette,
  Sliders,
  Square,
  Type,
  Unlock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ThemeElement } from "@/core/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveThemeMedia } from "@/core/ipc/commands";
import { resolveCssMediaUrls } from "./media";
import { VARIABLE_KEYS } from "@/features/slide-themes/samples";
import { alignToScreen } from "./geometry";
import type { AlignEdge } from "./geometry";
import { useThemeEditorStore } from "./store";
import { FontPicker } from "./FontPicker";
import { SymbolsPicker } from "./SymbolsPicker";
import { CssCodeEditor } from "./CssCodeEditor";
import { GradientBuilder } from "./GradientBuilder";
import { ShaderCanvas, SHADER_PRESETS } from "@/features/media-shaders/ShaderCanvas";
import { cn } from "@/core/lib/utils";

const FONT_WEIGHTS = [
  { label: "Normal", value: "400" },
  { label: "Médio", value: "500" },
  { label: "Seminegrito", value: "600" },
  { label: "Negrito", value: "700" },
  { label: "Extra-negrito", value: "800" },
];

const ALL_VARIABLES = [...new Set(Object.values(VARIABLE_KEYS).flat())].sort();

const ALIGN_BUTTONS: { label: string; edge: AlignEdge; icon: LucideIcon }[] = [
  { label: "Esquerda", edge: "left", icon: AlignHorizontalJustifyStart },
  { label: "Centro H", edge: "centerX", icon: AlignHorizontalJustifyCenter },
  { label: "Direita", edge: "right", icon: AlignHorizontalJustifyEnd },
  { label: "Topo", edge: "top", icon: AlignVerticalJustifyStart },
  { label: "Meio V", edge: "middle", icon: AlignVerticalJustifyCenter },
  { label: "Fundo", edge: "bottom", icon: AlignVerticalJustifyEnd },
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
  defaultOpen = true,
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

interface PropertiesPanelProps {
  selectedId: string | null;
}

export function PropertiesPanel({ selectedId }: PropertiesPanelProps) {
  const draft = useThemeEditorStore((s) => s.draft);
  const updateCss = useThemeEditorStore((s) => s.updateCss);
  const updateElement = useThemeEditorStore((s) => s.updateElement);

  if (!draft) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum tema carregado.</p>
    );
  }

  const selected = draft.elements.find((el) => el.id === selectedId) ?? null;

  if (!selected) {
    return <ThemeBackground draft={draft} updateCss={updateCss} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <GeneralSection selected={selected} updateElement={updateElement} />
      <PositionSection el={selected} updateElement={updateElement} />
      {selected.type === "TEXT" && (
        <TextSection el={selected} updateElement={updateElement} />
      )}
      {selected.type === "RECTANGLE" && (
        <RectangleSection el={selected} updateElement={updateElement} />
      )}
      {(selected.type === "IMAGE" || selected.type === "VIDEO") && (
        <ElementMediaSection
          guid={draft.guid}
          el={selected}
          updateElement={updateElement}
        />
      )}
      <AppearanceSection el={selected} updateElement={updateElement} />
      <AdvancedCssSection el={selected} updateElement={updateElement} />
    </div>
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
    <Section title="ELEMENTO" icon={Layers} defaultOpen={true}>
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

function PositionSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  function setPos(k: "left" | "top", value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const patchCoord = k === "left" ? { x: Math.round(num) } : { y: Math.round(num) };
    updateElement(el.id, {
      ...patchCoord,
      css: { ...el.css, [k]: `${num}px` },
    });
  }

  function setDim(k: "width" | "height", value: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    updateElement(el.id, {
      css: { ...el.css, [k]: `${num}px` },
    });
  }

  function setScale(value: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    updateElement(el.id, {
      css: { ...el.css, transform: `scale(${num / 100})` },
    });
  }

  function setMargin(side: string, value: string) {
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
    <Section title="POSIÇÃO & DIMENSÕES" icon={Move} defaultOpen={true}>
      {/* 2x2 Grid para Posição e Dimensão */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="X (px)">
          <Input
            type="number"
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.left)}
            onChange={(e) => setPos("left", e.target.value)}
          />
        </Field>
        <Field label="Y (px)">
          <Input
            type="number"
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.top)}
            onChange={(e) => setPos("top", e.target.value)}
          />
        </Field>
        <Field label="Largura (px)">
          <Input
            type="number"
            min={20}
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.width)}
            onChange={(e) => setDim("width", e.target.value)}
          />
        </Field>
        <Field label="Altura (px)">
          <Input
            type="number"
            min={20}
            className="h-8 font-mono text-xs"
            value={pxOf(el.css.height)}
            onChange={(e) => setDim("height", e.target.value)}
          />
        </Field>
      </div>

      {/* Alinhar à tela com ícones */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Alinhar à Tela
        </span>
        <div className="grid grid-cols-6 gap-1">
          {ALIGN_BUTTONS.map(({ label, edge, icon: Icon }) => (
            <Button
              key={edge}
              type="button"
              variant="outline"
              size="sm"
              title={`Alinhar ao ${label}`}
              className="h-8 p-0 flex items-center justify-center cursor-pointer hover:bg-muted"
              onClick={() => updateElement(el.id, alignToScreen(el, edge))}
            >
              <Icon className="size-3.5 text-foreground" />
            </Button>
          ))}
        </div>
      </div>

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
        <div className="grid grid-cols-2 gap-2">
          <Field label="Topo (px)">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingTop)}
              onChange={(e) => setMargin("paddingTop", e.target.value)}
            />
          </Field>
          <Field label="Direita (px)">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingRight)}
              onChange={(e) => setMargin("paddingRight", e.target.value)}
            />
          </Field>
          <Field label="Fundo (px)">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={pxOf(el.css.paddingBottom)}
              onChange={(e) => setMargin("paddingBottom", e.target.value)}
            />
          </Field>
          <Field label="Esquerda (px)">
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

  const hAlign = el.css.textAlign ?? "left";
  const vAlign = el.css.alignItems ?? "flex-start";

  return (
    <Section title="TEXTO & TIPOGRAFIA" icon={Type} defaultOpen={true}>
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
          { label: "next_verse", key: "next_verse" },
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

      {/* Tamanho, Peso e Altura */}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Tam. (px)">
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
        <Field label="Peso">
          <Select
            value={el.css.fontWeight ?? "400"}
            onValueChange={(value) => setCss({ fontWeight: value })}
          >
            <SelectTrigger className="h-8 text-xs">
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
        <Field label="Linha">
          <Input
            className="h-8 font-mono text-xs"
            value={el.css.lineHeight ?? "1.2"}
            onChange={(e) => setCss({ lineHeight: e.target.value })}
          />
        </Field>
      </div>

      {/* Alinhamento Horizontal e Vertical com Ícones */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">
            Alinhamento do Texto
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30">
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

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">
            Alinhamento Vertical
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30">
            {V_ALIGN_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const selected = vAlign === btn.value;
              return (
                <button
                  key={btn.value}
                  type="button"
                  title={btn.label}
                  onClick={() => setCss({ alignItems: btn.value, display: "flex" })}
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

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">
            Capitalização
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 p-0.5 bg-muted/30">
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
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
        <Field label="Cor do Texto">
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
        <Field label="Efeito">
          <Select
            value={el.css.textShadow ?? ""}
            onValueChange={(val) => setCss({ textShadow: val })}
          >
            <SelectTrigger className="h-8 text-xs">
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
    </Section>
  );
}

function RectangleSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  return (
    <Section title="RETÂNGULO" icon={Square} defaultOpen={true}>
      <Field label="Cor de Preenchimento">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={asHex(el.fill, "#1e3a8a")}
            onChange={(e) => updateElement(el.id, { fill: e.target.value })}
            className="size-8 rounded border border-border cursor-pointer p-0 shrink-0"
          />
          <Input
            value={el.fill ?? "#1e3a8a"}
            onChange={(e) => updateElement(el.id, { fill: e.target.value })}
            className="h-8 font-mono text-xs"
          />
        </div>
      </Field>
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
    <Section title={isVideo ? "VÍDEO" : "IMAGEM"} icon={isVideo ? Film : ImageIcon} defaultOpen={true}>
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

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
        <Field label="Borda (px)">
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
        <Field label="Arredondamento (px)">
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
      <Section title="PLANO DE FUNDO DO TEMA" icon={Palette} defaultOpen={true}>
        {/* Preview do Fundo */}
        <div
          className="h-20 w-full rounded-lg border border-border shadow-inner overflow-hidden relative"
          style={{
            background: resolveCssMediaUrls(draft.css.background) ?? "#000000",
          }}
        >
          {currentBg.startsWith("isf:") && (
            <ShaderCanvas shader={currentBg.replace("isf:", "")} />
          )}
        </div>

        {/* Abas de Tipos de Fundo */}
        <Tabs defaultValue="gradient" className="w-full">
          <TabsList className="grid grid-cols-4 h-8 p-0.5">
            <TabsTrigger value="gradient" className="text-[10px] px-1">Gradiente</TabsTrigger>
            <TabsTrigger value="solid" className="text-[10px] px-1">Cor</TabsTrigger>
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

          {/* Aba Shaders / ISF Animados */}
          <TabsContent value="shader" className="pt-2 flex flex-col gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              Shaders WebGL / ISF em Tempo Real
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SHADER_PRESETS.map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => updateCss({ background: `isf:${sh.id}` })}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all cursor-pointer overflow-hidden",
                    currentBg === `isf:${sh.id}`
                      ? "border-primary bg-primary/10 shadow-2xs font-semibold"
                      : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  <div className="h-12 w-full rounded border border-white/10 overflow-hidden relative">
                    <ShaderCanvas shader={sh.id} />
                  </div>
                  <span className="text-xs truncate">{sh.name}</span>
                </button>
              ))}
            </div>
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
