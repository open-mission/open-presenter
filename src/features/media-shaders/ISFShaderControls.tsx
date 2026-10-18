import { useState } from "react";
import {
  Code,
  ExternalLink,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import {
  ISF_PRESETS,
  parseISF,
  parseISFBackground,
  resolveISFSource,
  serializeISFBackground,
  type ISFInput,
} from "./isfEngine";
import { ShaderCanvas } from "./ShaderCanvas";

interface ISFShaderControlsProps {
  value: string;
  onChange: (newValue: string) => void;
}

function floatRgbaToHex(c: number[]): string {
  const r = Math.min(255, Math.max(0, Math.round((c[0] ?? 0) * 255)))
    .toString(16)
    .padStart(2, "0");
  const g = Math.min(255, Math.max(0, Math.round((c[1] ?? 0) * 255)))
    .toString(16)
    .padStart(2, "0");
  const b = Math.min(255, Math.max(0, Math.round((c[2] ?? 0) * 255)))
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
}

function hexToFloatRgba(hex: string, alpha = 1.0): [number, number, number, number] {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255 || 0;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255 || 0;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255 || 0;
  return [r, g, b, alpha];
}

export function ISFShaderControls({ value, onChange }: ISFShaderControlsProps) {
  const data = parseISFBackground(value);
  const source = resolveISFSource(data);
  const parsed = parseISF(source);
  const inputs = parsed.metadata.INPUTS ?? [];
  const currentInputs = data.inputs ?? {};

  const [showCodeEditor, setShowCodeEditor] = useState(Boolean(data.code));
  const [customCode, setCustomCode] = useState(source);
  const [editorError, setEditorError] = useState<string | null>(null);

  function handleSelectPreset(id: string) {
    const preset = ISF_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const pParsed = parseISF(preset.code);
    const defaultInputs: Record<string, any> = {};
    for (const inp of pParsed.metadata.INPUTS ?? []) {
      if (inp.DEFAULT !== undefined) {
        defaultInputs[inp.NAME] = inp.DEFAULT;
      }
    }
    setCustomCode(preset.code);
    onChange(serializeISFBackground({ id, inputs: defaultInputs }));
  }

  function handleInputChange(name: string, val: any) {
    const updatedInputs = {
      ...currentInputs,
      [name]: val,
    };
    onChange(
      serializeISFBackground({
        id: data.id,
        code: data.code,
        inputs: updatedInputs,
      }),
    );
  }

  function handleResetInput(input: ISFInput) {
    if (input.DEFAULT === undefined) return;
    handleInputChange(input.NAME, input.DEFAULT);
  }

  function handleApplyCustomCode() {
    const testParse = parseISF(customCode);
    if (testParse.error) {
      setEditorError(testParse.error);
      return;
    }
    setEditorError(null);
    const defaultInputs: Record<string, any> = {};
    for (const inp of testParse.metadata.INPUTS ?? []) {
      if (inp.DEFAULT !== undefined) {
        defaultInputs[inp.NAME] = inp.DEFAULT;
      }
    }
    onChange(
      serializeISFBackground({
        code: customCode,
        inputs: defaultInputs,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Seletor de Presets ISF com Miniaturas Animadas */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Presets de Shaders (ISF 2.0)
          </span>
          <a
            href="https://isf.video/using-isf/"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            isf.video <ExternalLink className="size-2.5" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ISF_PRESETS.map((sh) => {
            const isSelected = data.id === sh.id && !data.code;
            return (
              <button
                key={sh.id}
                type="button"
                onClick={() => handleSelectPreset(sh.id)}
                className={cn(
                  "group relative flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all cursor-pointer overflow-hidden",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-2xs font-semibold ring-1 ring-primary"
                    : "border-border/60 hover:bg-muted/50",
                )}
              >
                <div className="h-14 w-full rounded border border-white/10 overflow-hidden relative bg-black">
                  <ShaderCanvas shader={sh.id} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs truncate font-medium text-foreground">
                    {sh.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {sh.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles de Configuração dos INPUTS do ISF */}
      {inputs.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border/80 bg-muted/20 p-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="size-3.5 text-primary" />
              Parâmetros Interativos (ISF Inputs)
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {inputs.length} controles
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {inputs.map((input) => {
              const currentValue =
                currentInputs[input.NAME] !== undefined
                  ? currentInputs[input.NAME]
                  : input.DEFAULT;

              if (input.TYPE === "float") {
                const min = input.MIN ?? 0;
                const max = input.MAX ?? 3;
                const step = (max - min) / 100;
                const numVal =
                  typeof currentValue === "number" ? currentValue : min;

                return (
                  <div key={input.NAME} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground">
                        {input.LABEL ?? input.NAME}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {numVal.toFixed(2)}
                        </span>
                        {input.DEFAULT !== undefined && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-4 opacity-50 hover:opacity-100"
                            title="Restaurar padrão"
                            onClick={() => handleResetInput(input)}
                          >
                            <RotateCcw className="size-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={numVal}
                      onChange={(e) =>
                        handleInputChange(
                          input.NAME,
                          Number.parseFloat(e.target.value),
                        )
                      }
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    />
                  </div>
                );
              }

              if (input.TYPE === "color") {
                const colorArr = Array.isArray(currentValue)
                  ? currentValue
                  : [1, 1, 1, 1];
                const hex = floatRgbaToHex(colorArr);

                return (
                  <div
                    key={input.NAME}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="font-medium text-foreground">
                      {input.LABEL ?? input.NAME}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) =>
                          handleInputChange(
                            input.NAME,
                            hexToFloatRgba(e.target.value, colorArr[3] ?? 1.0),
                          )
                        }
                        className="size-6 cursor-pointer rounded border border-border/80 bg-transparent p-0"
                      />
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        {hex}
                      </span>
                      {input.DEFAULT !== undefined && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-4 opacity-50 hover:opacity-100"
                          title="Restaurar padrão"
                          onClick={() => handleResetInput(input)}
                        >
                          <RotateCcw className="size-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }

              if (input.TYPE === "bool") {
                const boolVal = Boolean(currentValue);
                return (
                  <div
                    key={input.NAME}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="font-medium text-foreground">
                      {input.LABEL ?? input.NAME}
                    </span>
                    <input
                      type="checkbox"
                      checked={boolVal}
                      onChange={(e) =>
                        handleInputChange(input.NAME, e.target.checked)
                      }
                      className="size-4 rounded accent-primary cursor-pointer"
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}

      {/* Alternância para Editor de Código Customizado ISF */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
        <Button
          variant="ghost"
          size="sm"
          className="justify-between text-xs text-muted-foreground hover:text-foreground h-8"
          onClick={() => setShowCodeEditor((v) => !v)}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Code className="size-3.5 text-primary" />
            Código Fonte ISF / Importar da Web
          </span>
          <span className="text-[10px] font-mono">
            {showCodeEditor ? "Ocultar" : "Expandir"}
          </span>
        </Button>

        {showCodeEditor && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground">
              Cole shaders diretamente do{" "}
              <a
                href="https://editor.isf.video/"
                target="_blank"
                rel="noreferrer"
                className="underline text-primary"
              >
                editor.isf.video
              </a>{" "}
              com cabeçalho <code>/*&#123; ... &#125;*/</code> e funções padrão.
            </p>

            <textarea
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              rows={9}
              spellCheck={false}
              className="w-full rounded-md border border-input bg-zinc-950 p-2 font-mono text-[11px] text-zinc-100 shadow-2xs outline-none focus:ring-1 focus:ring-ring"
              placeholder="Cole o código ISF completo aqui..."
            />

            {editorError && (
              <p className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                {editorError}
              </p>
            )}

            <Button
              size="sm"
              onClick={handleApplyCustomCode}
              className="gap-1.5 text-xs font-semibold"
            >
              <Play className="size-3.5" />
              Compilar & Aplicar Shader ISF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
