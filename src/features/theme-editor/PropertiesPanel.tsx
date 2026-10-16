import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { saveThemeMedia } from "@/core/ipc/commands";
import { resolveCssMediaUrls } from "./media";
import { VARIABLE_KEYS } from "@/features/slide-themes/samples";
import { alignToScreen } from "./geometry";
import type { AlignEdge } from "./geometry";
import { useThemeEditorStore } from "./store";

const FONT_PRESETS = [
  "Arial",
  "Georgia",
  "Helvetica",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
];

const FONT_WEIGHTS = [
  { label: "Normal", value: "400" },
  { label: "Médio", value: "500" },
  { label: "Seminegrito", value: "600" },
  { label: "Negrito", value: "700" },
  { label: "Extra-negrito", value: "800" },
];

const ALL_VARIABLES = [...new Set(Object.values(VARIABLE_KEYS).flat())].sort();

const ALIGN_BUTTONS: { label: string; edge: AlignEdge }[] = [
  { label: "Esquerda", edge: "left" },
  { label: "Centro H", edge: "centerX" },
  { label: "Direita", edge: "right" },
  { label: "Topo", edge: "top" },
  { label: "Meio V", edge: "middle" },
  { label: "Fundo", edge: "bottom" },
];

const CASE_BUTTONS = [
  { label: "Aa", value: "none", title: "Normal" },
  { label: "AA", value: "uppercase", title: "Maiúsculas" },
  { label: "aa", value: "lowercase", title: "Minúsculas" },
  { label: "Ab", value: "capitalize", title: "Capitalizar" },
];

const H_ALIGN_BUTTONS = [
  { label: "Esquerda", value: "left" },
  { label: "Centro", value: "center" },
  { label: "Direita", value: "right" },
  { label: "Justificado", value: "justify" },
];

const V_ALIGN_BUTTONS = [
  { label: "Topo", value: "flex-start" },
  { label: "Meio", value: "center" },
  { label: "Fundo", value: "flex-end" },
];

const TEXT_EFFECTS = [
  { label: "Nenhum", value: "" },
  { label: "Sombra", value: "2px 2px 4px rgba(0, 0, 0, 0.6)" },
  {
    label: "Contorno",
    value: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
  },
  { label: "Brilho", value: "0 0 12px rgba(255, 255, 255, 0.8)" },
];

const ASSET_TYPES = [
  { value: "music", label: "Música" },
  { value: "bible", label: "Bíblia" },
  { value: "text", label: "Texto" },
];

const BACKGROUND_PRESETS = [
  { label: "Preto", value: "#000000" },
  {
    label: "Azul marinho",
    value: "linear-gradient(180deg, #0b1e3a 0%, #000000 100%)",
  },
  {
    label: "Pôr do sol",
    value: "linear-gradient(135deg, #7c2d12 0%, #1e1b4b 100%)",
  },
  {
    label: "Vinho",
    value: "radial-gradient(circle at 50% 30%, #4c0519 0%, #000000 100%)",
  },
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
  return match ? Math.round(Number(match[1]) * 100) : 100;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
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
    <div className="flex flex-col gap-5">
      <Section title="NOME">
        <Input value={selected.id} disabled aria-label="Nome do elemento" />
      </Section>
      <LayoutSection el={selected} updateElement={updateElement} />
      {(selected.type === "IMAGE" || selected.type === "VIDEO") && (
        <ElementMediaSection
          guid={draft.guid}
          el={selected}
          updateElement={updateElement}
        />
      )}
      {selected.type === "TEXT" && (
        <TextSection el={selected} updateElement={updateElement} />
      )}
      <Section title="PREENCHIMENTO">
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-9 w-12 shrink-0 cursor-pointer p-1"
            aria-label="Cor de preenchimento"
            value={asHex(selected.css.background, "#000000")}
            onChange={(e) =>
              updateElement(selected.id, {
                fill: "solid",
                css: { ...selected.css, background: e.target.value },
              })
            }
          />
          <span className="text-xs text-muted-foreground">Cor sólida</span>
        </div>
      </Section>
      <AppearanceSection el={selected} updateElement={updateElement} />
      <VisibilitySection el={selected} updateElement={updateElement} />
      <AdvancedCssSection el={selected} updateElement={updateElement} />
    </div>
  );
}

type UpdateElement = (
  id: string,
  patch: Partial<ThemeElement>,
) => void;

function LayoutSection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const widthPct = (el.css.width ?? "").trim().endsWith("%");
  const heightPct = (el.css.height ?? "").trim().endsWith("%");

  function setSize(key: "width" | "height", raw: string) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    const pct = key === "width" ? widthPct : heightPct;
    updateElement(el.id, { css: { ...el.css, [key]: `${num}${pct ? "%" : "px"}` } });
  }

  function toggleUnit(key: "width" | "height", base: number) {
    const current = pxOf(el.css[key]);
    const pct = key === "width" ? widthPct : heightPct;
    const value = pct
      ? `${Math.round((current / 100) * base)}px`
      : `${Math.round((current / base) * 100)}%`;
    updateElement(el.id, { css: { ...el.css, [key]: value } });
  }

  function setScale(raw: string) {
    const pct = Number(raw);
    if (!Number.isFinite(pct) || pct <= 0) return;
    const css = { ...el.css };
    if (pct === 100) {
      delete css.transform;
    } else {
      css.transform = `scale(${pct / 100})`;
    }
    updateElement(el.id, { css });
  }

  function setMargin(key: string, raw: string) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    updateElement(el.id, { css: { ...el.css, [key]: `${num}px` } });
  }

  return (
    <Section title="LAYOUT">
      <div className="flex gap-2">
        <Field label="X">
          <Input
            type="number"
            aria-label="Posição X em pixels"
            value={Math.round(el.x)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isFinite(num)) return;
              updateElement(el.id, {
                x: num,
                css: { ...el.css, left: `${num}px` },
              });
            }}
          />
        </Field>
        <Field label="Y">
          <Input
            type="number"
            aria-label="Posição Y em pixels"
            value={Math.round(el.y)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isFinite(num)) return;
              updateElement(el.id, {
                y: num,
                css: { ...el.css, top: `${num}px` },
              });
            }}
          />
        </Field>
        <Field label="L">
          <div className="flex gap-1">
            <Input
              type="number"
              aria-label="Largura"
              value={pxOf(el.css.width)}
              onChange={(e) => setSize("width", e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 px-2"
              aria-label="Alternar unidade da largura"
              onClick={() => toggleUnit("width", 1920)}
            >
              {widthPct ? "%" : "px"}
            </Button>
          </div>
        </Field>
        <Field label="A">
          <div className="flex gap-1">
            <Input
              type="number"
              aria-label="Altura"
              value={pxOf(el.css.height)}
              onChange={(e) => setSize("height", e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 px-2"
              aria-label="Alternar unidade da altura"
              onClick={() => toggleUnit("height", 1080)}
            >
              {heightPct ? "%" : "px"}
            </Button>
          </div>
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Alinhar à tela
        </span>
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_BUTTONS.map(({ label, edge }) => (
            <Button
              key={edge}
              variant="outline"
              size="sm"
              onClick={() => updateElement(el.id, alignToScreen(el, edge))}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Field label="Escala (%)">
          <Input
            type="number"
            min={1}
            aria-label="Escala em porcentagem"
            value={scalePctOf(el.css.transform)}
            onChange={(e) => setScale(e.target.value)}
          />
        </Field>
        <Field label="Margem T">
          <Input
            type="number"
            min={0}
            aria-label="Margem superior"
            value={pxOf(el.css.paddingTop)}
            onChange={(e) => setMargin("paddingTop", e.target.value)}
          />
        </Field>
        <Field label="Margem R">
          <Input
            type="number"
            min={0}
            aria-label="Margem direita"
            value={pxOf(el.css.paddingRight)}
            onChange={(e) => setMargin("paddingRight", e.target.value)}
          />
        </Field>
        <Field label="Margem B">
          <Input
            type="number"
            min={0}
            aria-label="Margem inferior"
            value={pxOf(el.css.paddingBottom)}
            onChange={(e) => setMargin("paddingBottom", e.target.value)}
          />
        </Field>
        <Field label="Margem L">
          <Input
            type="number"
            min={0}
            aria-label="Margem esquerda"
            value={pxOf(el.css.paddingLeft)}
            onChange={(e) => setMargin("paddingLeft", e.target.value)}
          />
        </Field>
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
    for (const key of remove) delete css[key];
    updateElement(el.id, { css });
  }

  function insertVariable(key: string) {
    const current = el.text ?? "";
    const ta = areaRef.current;
    const start = ta?.selectionStart ?? current.length;
    const end = ta?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}{${key}}${current.slice(end)}`;
    updateElement(el.id, { text: next });
    const caret = start + key.length + 2;
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(caret, caret);
    });
  }

  function setWrap(value: string) {
    if (value === "sem-quebra") {
      setCss({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
    } else {
      setCss({ whiteSpace: "pre-line" }, ["overflow", "textOverflow"]);
    }
  }

  const wrapValue =
    el.css.whiteSpace === "nowrap" ? "sem-quebra" : "quebra";

  return (
    <Section title="TEXTO">
      <Textarea
        ref={areaRef}
        aria-label="Conteúdo do texto"
        value={el.text ?? ""}
        onChange={(e) => updateElement(el.id, { text: e.target.value })}
      />
      <div className="flex gap-1">
        <Select value="" onValueChange={(key) => insertVariable(key)}>
          <SelectTrigger className="flex-1" aria-label="Inserir variável">
            <SelectValue placeholder="{·} Inserir variável" />
          </SelectTrigger>
          <SelectContent position="popper">
            {ALL_VARIABLES.map((key) => (
              <SelectItem key={key} value={key}>
                {`{${key}}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Field label="Fonte">
          <Input
            list="theme-font-presets"
            aria-label="Família da fonte"
            value={el.css.fontFamily ?? ""}
            placeholder="Arial"
            onChange={(e) => setCss({ fontFamily: e.target.value })}
          />
          <datalist id="theme-font-presets">
            {FONT_PRESETS.map((font) => (
              <option key={font} value={font} />
            ))}
          </datalist>
        </Field>
        <Field label="Tam. (px)">
          <Input
            type="number"
            min={1}
            aria-label="Tamanho da fonte em pixels"
            value={pxOf(el.css.fontSize)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isFinite(num) || num <= 0) return;
              setCss({ fontSize: `${num}px` });
            }}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Field label="Peso">
          <Select
            value={el.css.fontWeight ?? "400"}
            onValueChange={(value) => setCss({ fontWeight: value })}
          >
            <SelectTrigger aria-label="Peso da fonte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Alt. linha">
          <Input
            aria-label="Altura da linha"
            value={el.css.lineHeight ?? ""}
            placeholder="1.25"
            onChange={(e) => setCss({ lineHeight: e.target.value })}
          />
        </Field>
        <Field label="Espaç. (px)">
          <Input
            type="number"
            aria-label="Espaçamento entre letras em pixels"
            value={pxOf(el.css.letterSpacing)}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isFinite(num)) return;
              setCss({ letterSpacing: `${num}px` });
            }}
          />
        </Field>
        <Field label="Cor">
          <Input
            type="color"
            className="h-9 cursor-pointer p-1"
            aria-label="Cor do texto"
            value={asHex(el.css.color, "#ffffff")}
            onChange={(e) => setCss({ color: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Horizontal
        </span>
        <div className="grid grid-cols-4 gap-1">
          {H_ALIGN_BUTTONS.map((opt) => (
            <Button
              key={opt.value}
              variant={(el.css.textAlign ?? "left") === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCss({ textAlign: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Vertical
        </span>
        <div className="grid grid-cols-3 gap-1">
          {V_ALIGN_BUTTONS.map((opt) => (
            <Button
              key={opt.value}
              variant={
                (el.css.justifyContent ?? "flex-start") === opt.value
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() =>
                setCss({
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: opt.value,
                })
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Field label="Caixa">
          <div className="flex gap-1">
            {CASE_BUTTONS.map((opt) => (
              <Button
                key={opt.value}
                variant={
                  (el.css.textTransform ?? "none") === opt.value
                    ? "default"
                    : "outline"
                }
                size="sm"
                title={opt.title}
                aria-label={`Caixa: ${opt.title}`}
                onClick={() => setCss({ textTransform: opt.value })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </Field>
      </div>
      <Field label="Ajuste">
        <Select value={wrapValue} onValueChange={setWrap}>
          <SelectTrigger aria-label="Ajuste do texto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="quebra">Quebra do texto</SelectItem>
            <SelectItem value="sem-quebra">Sem quebra</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Efeitos
        </span>
        <div className="grid grid-cols-4 gap-1">
          {TEXT_EFFECTS.map((fx) => {
            const active =
              fx.value === ""
                ? !el.css.textShadow
                : el.css.textShadow === fx.value;
            return (
              <Button
                key={fx.label}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (fx.value === "") {
                    const css = { ...el.css };
                    delete css.textShadow;
                    updateElement(el.id, { css });
                  } else {
                    setCss({ textShadow: fx.value });
                  }
                }}
              >
                {fx.label}
              </Button>
            );
          })}
        </div>
      </div>
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
    <Section title="APARÊNCIA">
      <div className="flex gap-2">
        <Field label={`Opacidade (${opacityPct}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            aria-label="Opacidade em porcentagem"
            className="h-9 w-full accent-primary"
            value={opacityPct}
            onChange={(e) => {
              const pct = Number(e.target.value);
              if (!Number.isFinite(pct)) return;
              updateElement(el.id, {
                css: { ...el.css, opacity: String(pct / 100) },
              });
            }}
          />
        </Field>
        <Field label="Borda (px)">
          <Input
            type="number"
            min={0}
            aria-label="Espessura da borda em pixels"
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
      </div>
    </Section>
  );
}

function VisibilitySection({
  el,
  updateElement,
}: {
  el: ThemeElement;
  updateElement: UpdateElement;
}) {
  const current = el.assetTypeVisibility ?? [];

  function toggle(asset: string) {
    const all = ASSET_TYPES.map((a) => a.value);
    const effective = current.length === 0 ? all : current;
    const next = effective.includes(asset)
      ? effective.filter((a) => a !== asset)
      : [...effective, asset];
    updateElement(el.id, {
      assetTypeVisibility: next.length === all.length ? [] : next,
    });
  }

  return (
    <Section title="VISIBILIDADE">
      <div className="grid grid-cols-2 gap-1">
        {ASSET_TYPES.map(({ value, label }) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent/50"
          >
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={current.length === 0 || current.includes(value)}
              onChange={() => toggle(value)}
            />
            {label}
          </label>
        ))}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        Sem seleção, o elemento aparece em todos os conteúdos.
      </p>
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
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  function renameKey(oldKey: string, nextKey: string) {
    if (nextKey === oldKey || nextKey.trim() === "") return;
    const css: Record<string, string> = {};
    for (const [k, v] of Object.entries(el.css)) {
      css[k === oldKey ? nextKey.trim() : k] = v;
    }
    updateElement(el.id, { css });
  }

  function setEntry(key: string, value: string) {
    updateElement(el.id, { css: { ...el.css, [key]: value } });
  }

  function removeEntry(key: string) {
    const css = { ...el.css };
    delete css[key];
    updateElement(el.id, { css });
  }

  return (
    <Section title="CSS AVANÇADO">
      {Object.entries(el.css).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <Input
            aria-label="Propriedade CSS"
            className="font-mono text-xs"
            value={key}
            onChange={(e) => renameKey(key, e.target.value)}
          />
          <Input
            aria-label={`Valor de ${key}`}
            className="font-mono text-xs"
            value={value}
            onChange={(e) => setEntry(key, e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Remover ${key}`}
            onClick={() => removeEntry(key)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <Input
          aria-label="Nova propriedade CSS"
          className="font-mono text-xs"
          placeholder="propriedade"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <Input
          aria-label="Valor da nova propriedade"
          className="font-mono text-xs"
          placeholder="valor"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          aria-label="Adicionar propriedade"
          disabled={newKey.trim() === ""}
          onClick={() => {
            setEntry(newKey.trim(), newValue);
            setNewKey("");
            setNewValue("");
          }}
        >
          <Plus />
        </Button>
      </div>
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
      const saved = await saveThemeMedia(
        guid,
        file.name,
        Array.from(bytes),
      );
      if (!/^media:\/\/[^/]+\/.+$/.test(saved)) {
        setError("Resposta inesperada do servidor de mídia.");
        return;
      }
      updateElement(el.id, { src: saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Section title="ARQUIVO">
      {(el.src ?? "") !== "" && (
        <p
          className="truncate px-1 font-mono text-[11px] text-muted-foreground"
          title={el.src}
        >
          {el.src}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={isVideo ? ".mp4" : ".png,.jpg,.jpeg,.webp"}
        className="hidden"
        aria-label={isVideo ? "Enviar vídeo" : "Enviar imagem"}
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
        {uploading ? "Enviando…" : "Arquivo…"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
      const saved = await saveThemeMedia(
        draft.guid,
        file.name,
        Array.from(bytes),
      );
      const match = saved.match(/^media:\/\/([^/]+)\/(.+)$/);
      if (!match) {
        setError("Resposta inesperada do servidor de mídia.");
        return;
      }
      updateCss({ background: `url(${saved})` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "localhost";

  return (
    <div className="flex flex-col gap-5">
      <Section title="FUNDO PADRÃO">
        <div
          className="h-16 w-full rounded-md border border-border"
          style={{
            background:
              resolveCssMediaUrls(draft.css.background, host) ?? "#000000",
          }}
          aria-label="Prévia do fundo"
        />
        <Field label="Cor">
          <Input
            type="color"
            className="h-9 cursor-pointer p-1"
            aria-label="Cor do fundo"
            value={asHex(draft.css.background, "#000000")}
            onChange={(e) => updateCss({ background: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Gradientes
          </span>
          <div className="grid grid-cols-2 gap-1">
            {BACKGROUND_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={
                  draft.css.background === preset.value ? "default" : "outline"
                }
                size="sm"
                onClick={() => updateCss({ background: preset.value })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Imagem
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            aria-label="Enviar imagem de fundo"
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
            {uploading ? "Enviando…" : "Enviar imagem"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </Section>
    </div>
  );
}
