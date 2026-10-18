import { useEffect, useState } from "react";
import { Code, List, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function formatCssObjectToString(css: Record<string, string>): string {
  return Object.entries(css)
    .filter(([k]) => !k.startsWith("__"))
    .map(([key, val]) => `  ${camelToKebab(key)}: ${val};`)
    .join("\n");
}

export function parseCssStringToRecord(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = str.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("/*") || line.startsWith("//")) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let val = line.slice(colonIndex + 1).trim();
    if (val.endsWith(";")) {
      val = val.slice(0, -1).trim();
    }
    if (key && val) {
      result[kebabToCamel(key)] = val;
    }
  }
  return result;
}

interface CssCodeEditorProps {
  css: Record<string, string>;
  onChange: (css: Record<string, string>) => void;
  className?: string;
}

export function CssCodeEditor({ css, onChange, className }: CssCodeEditorProps) {
  const [text, setText] = useState(() => formatCssObjectToString(css));
  const [mode, setMode] = useState<"code" | "table">("code");
  const [isFocused, setIsFocused] = useState(false);

  // Sync external changes when not actively typing
  useEffect(() => {
    if (!isFocused) {
      setText(formatCssObjectToString(css));
    }
  }, [css, isFocused]);

  function handleTextChange(newText: string) {
    setText(newText);
    const parsed = parseCssStringToRecord(newText);
    onChange(parsed);
  }

  function handleFormat() {
    const parsed = parseCssStringToRecord(text);
    const formatted = formatCssObjectToString(parsed);
    setText(formatted);
    onChange(parsed);
  }

  const lines = text.split("\n");

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-border/70 bg-zinc-950 p-2.5 text-xs ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
          <Code className="size-3.5 text-primary" />
          <span>custom.css</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-6 px-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title="Formatar declarações CSS"
          >
            <Wand2 className="size-3 mr-1" />
            Formatar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode(mode === "code" ? "table" : "code")}
            className="h-6 px-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title={mode === "code" ? "Alternar para lista" : "Alternar para editor de código"}
          >
            {mode === "code" ? <List className="size-3 mr-1" /> : <Code className="size-3 mr-1" />}
            {mode === "code" ? "Lista" : "Código"}
          </Button>
        </div>
      </div>

      {mode === "code" ? (
        <div className="relative flex min-h-[140px] max-h-[300px] overflow-hidden rounded bg-black/60 font-mono text-xs border border-white/5">
          {/* Line Numbers Gutter */}
          <div className="flex flex-col select-none py-2 px-2 text-right text-[11px] text-zinc-600 border-r border-white/5 bg-zinc-900/40">
            {lines.map((_, i) => (
              <span key={i} className="leading-5">
                {i + 1}
              </span>
            ))}
          </div>

          {/* Code Textarea */}
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              handleFormat();
            }}
            placeholder="/* Escreva propriedades CSS aqui */&#10;color: #ffffff;&#10;text-transform: uppercase;"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="flex-1 resize-none bg-transparent p-2 text-xs text-sky-300 leading-5 outline-none font-mono selection:bg-primary/30"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
          {Object.entries(css).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="w-1/3 truncate text-sky-400" title={camelToKebab(key)}>
                {camelToKebab(key)}:
              </span>
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  onChange({ ...css, [key]: e.target.value });
                }}
                className="flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-0.5 text-zinc-200 text-[11px] outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
        <span>Sintaxe: propriedade: valor;</span>
        <span>{Object.keys(css).length} propriedades ativas</span>
      </div>
    </div>
  );
}
