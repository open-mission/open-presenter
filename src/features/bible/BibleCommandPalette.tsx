import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CornerDownLeft,
  Loader2,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBibleStore } from "./store";
import {
  BIBLE_BOOKS,
  parseBibleReference,
  type ParsedBibleReference,
} from "./bibleParser";
import { getBibleChapter } from "@/core/ipc/commands";
import type { BibleVerse } from "@/core/types";

interface BibleCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PopularReference {
  ref: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  label: string;
}

const POPULAR_REFERENCES: PopularReference[] = [
  { ref: "João 3:16", bookId: 43, bookName: "João", chapter: 3, verse: 16, label: "Deus amou o mundo de tal maneira..." },
  { ref: "Salmos 23:1", bookId: 19, bookName: "Salmos", chapter: 23, verse: 1, label: "O Senhor é o meu pastor; nada me faltará." },
  { ref: "Filipenses 4:13", bookId: 50, bookName: "Filipenses", chapter: 4, verse: 13, label: "Posso todas as coisas naquele que me fortalece." },
  { ref: "1 Coríntios 13:4", bookId: 46, bookName: "1 Coríntios", chapter: 13, verse: 4, label: "O amor é paciente, o amor é bondoso..." },
  { ref: "Romanos 8:28", bookId: 45, bookName: "Romanos", chapter: 8, verse: 28, label: "Todas as coisas cooperam para o bem daqueles que amam a Deus." },
  { ref: "Gênesis 1:1", bookId: 1, bookName: "Gênesis", chapter: 1, verse: 1, label: "No princípio criou Deus os céus e a terra." },
  { ref: "Provérbios 3:5", bookId: 20, bookName: "Provérbios", chapter: 3, verse: 5, label: "Confie no Senhor de todo o seu coração..." },
  { ref: "Isaías 40:31", bookId: 23, bookName: "Isaías", chapter: 40, verse: 31, label: "Os que esperam no Senhor renovam as suas forças..." },
];

export function BibleCommandPalette({ open, onOpenChange }: BibleCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [versePreview, setVersePreview] = useState<BibleVerse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeVersionId = useBibleStore((s) => s.activeVersionId);
  const goToVerse = useBibleStore((s) => s.goToVerse);
  const searchWords = useBibleStore((s) => s.searchWords);

  // Foco automático ao abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setVersePreview(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Executa o parser em tempo real sobre o texto digitado
  const parsed = useMemo<ParsedBibleReference | null>(() => {
    return parseBibleReference(query);
  }, [query]);

  // Se uma referência for detectada, busca o texto real do versículo para exibir prévia instantânea
  useEffect(() => {
    if (!parsed || !activeVersionId) {
      setVersePreview(null);
      return;
    }

    let isCurrent = true;
    const targetVerse = parsed.verse ?? 1;

    setPreviewLoading(true);
    getBibleChapter(activeVersionId, parsed.bookId, parsed.chapter)
      .then((verses) => {
        if (!isCurrent) return;
        const found = verses.find((v) => v.verse === targetVerse) ?? verses[0] ?? null;
        setVersePreview(found);
      })
      .catch(() => {
        if (!isCurrent) return;
        setVersePreview(null);
      })
      .finally(() => {
        if (isCurrent) setPreviewLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [parsed, activeVersionId]);

  // Livros correspondentes quando ainda não há capítulo/versículo completo
  const matchedBooks = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean || parsed) return [];
    return BIBLE_BOOKS.filter((b) => {
      const name = b.name.toLowerCase();
      const abbrev = b.abbrev.toLowerCase();
      return name.startsWith(clean) || abbrev.startsWith(clean) || b.aliases.some((a) => a.startsWith(clean));
    }).slice(0, 6);
  }, [query, parsed]);

  async function handleConfirm(target: { bookId: number; chapter: number; verse?: number }, autoPresent: boolean) {
    onOpenChange(false);
    await goToVerse(target.bookId, target.chapter, target.verse ?? 1, autoPresent);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const autoPresent = e.shiftKey;

      if (parsed) {
        void handleConfirm(parsed, autoPresent);
        return;
      }

      if (matchedBooks.length > 0) {
        setQuery(`${matchedBooks[0].name} `);
        return;
      }

      // Se não for referência, realiza busca por palavra na Bíblia
      const clean = query.trim();
      if (clean) {
        onOpenChange(false);
        void searchWords(clean);
      }
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl w-full max-w-[94vw] p-0 gap-0 overflow-hidden border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar Referência Bíblica (Command Palette)</DialogTitle>
        </DialogHeader>

        {/* Input Bar Superior estilo Spotlight */}
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 bg-muted/20">
          <Sparkles className="size-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite a referência (ex: João 3:16, Sl 23, 1co 13, amor)..."
            className="flex-1 bg-transparent text-base md:text-lg font-medium placeholder:text-muted-foreground outline-none text-foreground"
          />

          <div className="flex items-center gap-2 shrink-0">
            {activeVersionId && (
              <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1">
                {activeVersionId}
              </Badge>
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md"
              >
                <X className="size-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-6 items-center rounded border border-border/80 bg-muted px-2 font-mono text-xs text-muted-foreground">
              Esc
            </kbd>
          </div>
        </div>

        {/* Corpo do Palette */}
        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
          {/* Caso 1: Referência identificada pelo Parser */}
          {parsed && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3 animate-in fade-in-50 duration-150">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">
                    📖
                  </span>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-bold text-base text-foreground">
                      {parsed.bookName} {parsed.chapter}
                      {parsed.verse ? `:${parsed.verse}` : ""}
                    </span>
                    <Badge variant="outline" className="text-[11px] text-primary border-primary/30 shrink-0">
                      Referência Detectada
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleConfirm(parsed, false)}
                    className="h-8 text-xs cursor-pointer font-semibold px-3"
                  >
                    <Check className="size-3.5 mr-1 text-primary" />
                    Selecionar (Enter)
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleConfirm(parsed, true)}
                    className="h-8 text-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3"
                  >
                    <Play className="size-3 mr-1 fill-current" />
                    Projetar (⇧Enter)
                  </Button>
                </div>
              </div>

              {/* Prévia do texto bíblico em tempo real */}
              <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="size-3.5 animate-spin" />
                    Carregando texto do versículo...
                  </div>
                ) : versePreview ? (
                  <p className="text-sm leading-relaxed text-foreground/90 font-serif italic">
                    "{versePreview.text}"
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pressione Enter para navegar até {parsed.bookName} {parsed.chapter}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Caso 2: Sugestões de livros enquanto digita */}
          {!parsed && matchedBooks.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Livros Correspondentes (clique para autocompletar)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {matchedBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setQuery(`${book.name} `);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2.5 text-left text-xs hover:border-primary hover:bg-muted/40 cursor-pointer transition-all"
                  >
                    <span className="font-semibold text-foreground">{book.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {book.abbrev}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caso 3: Opção para pesquisar palavra completa */}
          {!parsed && query.trim().length > 1 && (
            <div
              onClick={() => {
                onOpenChange(false);
                void searchWords(query.trim());
              }}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 hover:border-primary/70 hover:bg-muted/40 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Search className="size-4 text-primary" />
                <span className="text-xs text-foreground font-medium">
                  Pesquisar por <strong className="text-primary">"{query.trim()}"</strong> em toda a Bíblia
                </span>
              </div>
              <CornerDownLeft className="size-3.5 text-muted-foreground" />
            </div>
          )}

          {/* Caso 4: Quando o input está vazio, exibe atalhos populares */}
          {!parsed && !query.trim() && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="size-3.5" />
                  Passagens Rápidas & Populares
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Clique ou tecle para ir direto
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POPULAR_REFERENCES.map((pop) => (
                  <button
                    key={pop.ref}
                    type="button"
                    onClick={() => void handleConfirm(pop, false)}
                    className="group flex flex-col items-start rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary hover:bg-muted/40 cursor-pointer transition-all"
                  >
                    <div className="flex w-full items-center justify-between mb-1">
                      <span className="font-bold text-xs text-primary group-hover:underline">
                        {pop.ref}
                      </span>
                      <CornerDownLeft className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {pop.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer com atalhos de teclado */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                ↵ Enter
              </kbd>
              Selecionar no Preview
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                ⇧ Shift + ↵
              </kbd>
              Projetar Ao Vivo
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <span>Atalho global:</span>
            <kbd className="rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K / Ctrl+K
            </kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
