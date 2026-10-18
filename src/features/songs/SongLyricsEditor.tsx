import { useRef, useState, useMemo, type KeyboardEvent } from "react";
import {
  Code,
  FolderPlus,
  HelpCircle,
  MessageSquare,
  Music2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/core/lib/utils";
import {
  SECTION_OPTIONS,
  tokenizeLyricsLine,
} from "./songEditorUtils";
import { isChordLine } from "@/core/lib/lyrics";

interface SongLyricsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  slidesCount?: number;
  mode?: "lyrics" | "text";
}

export function SongLyricsEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  slidesCount = 0,
  mode = "lyrics",
}: SongLyricsEditorProps) {
  const [syntaxEnabled, setSyntaxEnabled] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lyricsMode = mode === "lyrics";
  const showSyntax = lyricsMode && syntaxEnabled;

  const lines = useMemo(() => value.split("\n"), [value]);
  const wordsCount = useMemo(() => {
    return value
      .trim()
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 0 &&
          (!lyricsMode || (!w.startsWith("//") && !w.startsWith("##"))),
      )
      .length;
  }, [value, lyricsMode]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (backdropRef.current) {
      backdropRef.current.scrollTop = ta.scrollTop;
      backdropRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + textToInsert);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);
    const updated = before + textToInsert + after;
    onChange(updated);

    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + textToInsert.length;
      ta.setSelectionRange(newPos, newPos);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      insertTextAtCursor("  ");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card/60 shadow-sm">
      {/* Barra de Ferramentas do Editor */}
      {lyricsMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-medium gap-1.5 border-dashed"
                disabled={disabled}
              >
                <FolderPlus className="size-3.5 text-indigo-400" />
                <span>+ Seção</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {SECTION_OPTIONS.map((sec) => (
                <DropdownMenuItem
                  key={sec.type}
                  onClick={() => insertTextAtCursor(`\n\n## ${sec.label}\n`)}
                  className="text-xs cursor-pointer"
                >
                  <span className="font-medium">{sec.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                    ## {sec.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertTextAtCursor("\n// ")}
            className="h-7 text-xs text-muted-foreground hover:text-emerald-400 gap-1.5"
            disabled={disabled}
            title="Adicionar linha de comentário / instrução (não sai no telão)"
          >
            <MessageSquare className="size-3.5 text-emerald-500/80" />
            <span>// Comentário</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertTextAtCursor("[C]")}
            className="h-7 text-xs text-muted-foreground hover:text-amber-400 gap-1.5"
            disabled={disabled}
            title="Adicionar cifra entre colchetes (ex.: [G], [Am7]) para tela de retorno"
          >
            <Music2 className="size-3.5 text-amber-500/80" />
            <span>[Cifra]</span>
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={syntaxEnabled ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSyntaxEnabled(!syntaxEnabled)}
            className={cn(
              "h-7 text-xs gap-1.5 px-2.5",
              syntaxEnabled && "bg-primary/10 text-primary border border-primary/20",
            )}
            title="Alternar realce de sintaxe na letra"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">Sintaxe</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                title="Ajuda sobre a sintaxe"
              >
                <HelpCircle className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-80 text-xs p-3.5 space-y-2.5">
              <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                <Code className="size-4 text-primary" />
                Guia de Sintaxe da Letra
              </h4>
              <div className="space-y-2 text-muted-foreground">
                <div>
                  <div className="font-medium text-foreground flex items-center gap-1 font-mono">
                    <span className="text-indigo-400">## Refrão</span>
                  </div>
                  <p className="text-[11px]">
                    Nomeia o bloco e inicia um novo slide com rótulo (ex.: Refrão, Verso, Ponte).
                  </p>
                </div>
                <div>
                  <div className="font-medium text-foreground flex items-center gap-1 font-mono">
                    <span className="text-emerald-400">// Instrução</span>
                  </div>
                  <p className="text-[11px]">
                    Comentários e notas musicais. Não são exibidos na projeção pública.
                  </p>
                </div>
                <div>
                  <div className="font-medium text-foreground flex items-center gap-1 font-mono">
                    <span className="text-amber-400">[G]</span> ou <span className="text-amber-400">[Am7]</span>
                  </div>
                  <p className="text-[11px]">
                    Cifras inline. Aparecem no retorno para a equipe, mas são ocultadas no telão.
                  </p>
                </div>
                <div>
                  <p className="text-[11px]">
                    Uma <strong className="text-foreground">linha em branco</strong> separa os versos em slides diferentes.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      ) : (
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3 py-2">
          <span className="text-xs font-semibold text-foreground">Textos</span>
          <span className="text-[11px] text-muted-foreground">
            Linha em branco = novo slide
          </span>
        </div>
      )}

      {/* Área do Editor */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden bg-background">
        {/* Calha com numeração de linhas */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="select-none flex flex-col py-3 px-2 border-r border-border/50 bg-muted/20 text-right text-[11px] font-mono text-muted-foreground/40 overflow-hidden leading-6 min-w-9"
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Contêiner de Texto e Sintaxe */}
        <div className="relative flex-1 overflow-hidden">
          {/* Camada de Fundo com Realce de Sintaxe */}
          {showSyntax && (
            <div
              ref={backdropRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden p-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words select-none"
            >
              {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                const isComment = trimmed.startsWith("//");
                const isSection = trimmed.startsWith("##");
                const isChord = isChordLine(line);

                if (line === "") {
                  return <div key={lineIdx}>{"\u00A0"}</div>;
                }

                if (isComment) {
                  return (
                    <div
                      key={lineIdx}
                      className="text-emerald-500/80 italic font-medium"
                    >
                      {line}
                    </div>
                  );
                }

                if (isSection) {
                  return (
                    <div key={lineIdx} className="font-bold text-indigo-400">
                      <span className="inline-block rounded bg-indigo-500/15 px-1.5 py-0.5 border border-indigo-500/30 text-xs">
                        {line}
                      </span>
                    </div>
                  );
                }

                if (isChord) {
                  return (
                    <div
                      key={lineIdx}
                      className="font-bold text-sky-400 font-mono tracking-wide"
                    >
                      {line}
                    </div>
                  );
                }

                const tokens = tokenizeLyricsLine(line);
                return (
                  <div key={lineIdx} className="text-foreground/90">
                    {tokens.map((token, tokIdx) => {
                      if (token.type === "chord") {
                        return (
                          <span
                            key={tokIdx}
                            className="font-bold text-amber-400 bg-amber-400/15 border border-amber-400/25 px-1 py-0.5 rounded text-xs mx-0.5 align-baseline"
                          >
                            {token.value}
                          </span>
                        );
                      }
                      return <span key={tokIdx}>{token.value}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Textarea em Primeiro Plano */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              placeholder ??
              (mode === "text"
                ? "Escreva os textos aqui…\n\nDeixe uma linha em branco para criar um novo slide"
                : "Digite ou cole a letra aqui…\n\n## Refrão\nDeixe uma linha em branco para criar um novo slide")
            }
            spellCheck={false}
            className={cn(
              "absolute inset-0 h-full w-full resize-none p-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words border-0 bg-transparent focus:outline-none focus:ring-0",
              showSyntax
                ? "text-transparent caret-primary selection:bg-primary/25"
                : "text-foreground",
            )}
          />
        </div>
      </div>

      {/* Rodapé com Estatísticas */}
      <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{lines.length} linhas</span>
          <span>·</span>
          <span>{wordsCount} palavras</span>
          <span>·</span>
          <span className="font-medium text-foreground">
            {slidesCount} {slidesCount === 1 ? "slide gerado" : "slides gerados"}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-muted-foreground/70">
          <span>Linha em branco = Novo slide</span>
        </div>
      </div>
    </div>
  );
}
