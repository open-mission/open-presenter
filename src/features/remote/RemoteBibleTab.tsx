import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Columns2,
  Radio,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  BibleBook,
  BibleSearchResult,
  BibleVerse,
  BibleVerseCompare,
  BibleVersion,
  LiveSlide,
} from "@/core/types";
import { parseBibleReference } from "../bible/bibleParser";
import { splitVerseText } from "../bible/verseSplitter";

interface RemoteBibleTabProps {
  token: string;
  live: LiveSlide | null;
  onPost: (path: string, body?: unknown) => Promise<boolean>;
}

export function RemoteBibleTab({ token, live, onPost }: RemoteBibleTabProps) {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [activeBookId, setActiveBookId] = useState<number>(1);
  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [selectedVerseNum, setSelectedVerseNum] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modos de visualização
  const [viewMode, setViewMode] = useState<"reader" | "books" | "chapters">("reader");
  const [testament, setTestament] = useState<"all" | "ot" | "nt">("all");
  const [bookSearch, setBookSearch] = useState("");

  // Busca rápida por referência
  const [quickRef, setQuickRef] = useState("");

  // Busca por palavra
  const [wordQuery, setWordQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Comparação de versões
  const [compareTarget, setCompareTarget] = useState<{
    bookId: number;
    chapter: number;
    verse: number;
    bookName: string;
  } | null>(null);
  const [compareResults, setCompareResults] = useState<BibleVerseCompare[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  // Carrega versões bíblicas disponíveis
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/bible/versions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Falha ao carregar versões");
        const list = (await res.json()) as BibleVersion[];
        if (!cancelled) {
          setVersions(list);
          if (list.length > 0) {
            setActiveVersionId(list[0].id);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Carrega livros quando a versão mudar
  useEffect(() => {
    if (!activeVersionId) return;
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/v1/bible/books?version=${encodeURIComponent(activeVersionId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Falha ao carregar livros");
        const bList = (await res.json()) as BibleBook[];
        if (!cancelled) {
          setBooks(bList);
          const firstBook = bList[0];
          if (firstBook) {
            setActiveBookId(firstBook.id);
            setActiveChapter(1);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeVersionId, token]);

  // Carrega versículos do capítulo selecionado
  const loadChapter = useCallback(
    async (versionId: string, bookId: number, chapter: number) => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/v1/bible/chapter?version=${encodeURIComponent(
            versionId,
          )}&book=${bookId}&chapter=${chapter}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Falha ao carregar capítulo");
        const vList = (await res.json()) as BibleVerse[];
        setVerses(vList);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (activeVersionId && activeBookId && activeChapter) {
      void loadChapter(activeVersionId, activeBookId, activeChapter);
    }
  }, [activeVersionId, activeBookId, activeChapter, loadChapter]);

  const activeBook = useMemo(
    () => books.find((b) => b.id === activeBookId),
    [books, activeBookId],
  );

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    return books.filter((b) => {
      if (testament === "ot" && b.testamentReferenceId !== 1) return false;
      if (testament === "nt" && b.testamentReferenceId !== 2) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.abbrev.toLowerCase().includes(q)
      );
    });
  }, [books, testament, bookSearch]);

  // Apresenta versículo
  const handlePresent = useCallback(
    async (verse: BibleVerse, versionOverride?: string, partIndex = 0) => {
      const vId = versionOverride || activeVersionId;
      const bName = activeBook?.name ?? `Livro ${activeBookId}`;

      const parts = splitVerseText(verse.text, 220);
      const safePart = Math.max(0, Math.min(partIndex, parts.length - 1));
      const isSplit = parts.length > 1;
      const partSuffix = isSplit ? ` (${safePart + 1}/${parts.length})` : "";

      const nextV = verses.find((v) => v.verse === verse.verse + 1);
      const prevV = verses.find((v) => v.verse === verse.verse - 1);

      let nextText: string | null = null;
      if (safePart < parts.length - 1) {
        nextText = parts[safePart + 1];
      } else if (nextV) {
        const nextParts = splitVerseText(nextV.text, 220);
        nextText = nextParts[0];
      }

      let prevText: string | null = null;
      if (safePart > 0) {
        prevText = parts[safePart - 1];
      } else if (prevV) {
        const prevParts = splitVerseText(prevV.text, 220);
        prevText = prevParts[prevParts.length - 1];
      }

      setSelectedVerseNum(verse.verse);

      await onPost("present-bible", {
        version_id: vId,
        book_id: activeBookId,
        book_name: bName,
        chapter: activeChapter,
        verse: verse.verse,
        text: parts[safePart],
        part_suffix: partSuffix,
        prev_text: prevText,
        next_text: nextText,
      });
    },
    [activeVersionId, activeBook, activeBookId, activeChapter, verses, onPost],
  );

  // Busca por palavra
  const handleSearchWords = useCallback(
    async (q: string) => {
      const clean = q.trim();
      if (!clean) {
        setIsSearching(false);
        setSearchResults([]);
        return;
      }

      try {
        setLoading(true);
        setIsSearching(true);
        const res = await fetch(
          `/api/v1/bible/search?version=${encodeURIComponent(
            activeVersionId,
          )}&q=${encodeURIComponent(clean)}&limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Erro na pesquisa");
        const list = (await res.json()) as BibleSearchResult[];
        setSearchResults(list);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [activeVersionId, token],
  );

  // Referência Rápida (Ex: Jo 3:16)
  const handleQuickRef = useCallback(
    async (raw: string) => {
      const parsed = parseBibleReference(raw);
      if (!parsed) return;

      const book = books.find((b) => b.id === parsed.bookId);
      if (!book) return;

      setActiveBookId(parsed.bookId);
      setActiveChapter(parsed.chapter);
      setViewMode("reader");

      try {
        setLoading(true);
        const res = await fetch(
          `/api/v1/bible/chapter?version=${encodeURIComponent(
            activeVersionId,
          )}&book=${parsed.bookId}&chapter=${parsed.chapter}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const vList = (await res.json()) as BibleVerse[];
          setVerses(vList);
          if (parsed.verse) {
            const found = vList.find((v) => v.verse === parsed.verse);
            if (found) {
              setSelectedVerseNum(parsed.verse);
              await handlePresent(found);
            }
          }
        }
      } catch {}
      setLoading(false);
    },
    [books, activeVersionId, token, handlePresent],
  );

  // Comparar versões
  const handleOpenCompare = useCallback(
    async (verseNum: number) => {
      if (!activeBook) return;
      const allVersionIds = versions.map((v) => v.id).join(",");

      setCompareTarget({
        bookId: activeBookId,
        chapter: activeChapter,
        verse: verseNum,
        bookName: activeBook.name,
      });
      setIsComparing(true);

      try {
        setLoading(true);
        const res = await fetch(
          `/api/v1/bible/compare?book=${activeBookId}&chapter=${activeChapter}&verse=${verseNum}&versions=${encodeURIComponent(
            allVersionIds,
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const list = (await res.json()) as BibleVerseCompare[];
          setCompareResults(list);
        }
      } catch {}
      setLoading(false);
    },
    [activeBook, activeBookId, activeChapter, versions, token],
  );

  const isCurrentLiveVerse =
    live?.content.kind === "scripture" && !live.cleared && !live.blackout;

  return (
    <div className="flex flex-col gap-3 pb-8">
      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/60 p-2 text-xs text-red-300">
          {error}
        </div>
      )}
      {/* Barra de Versão e Navegação Rápida */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
        {/* Seletor de Versão */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
            <BookOpen className="size-4 text-emerald-400" />
            <span>Versão:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-1 max-w-[220px]">
            <select
              value={activeVersionId}
              onChange={(e) => setActiveVersionId(e.target.value)}
              className="w-full h-8 rounded-lg border border-zinc-700 bg-zinc-800 px-2 text-xs font-semibold text-zinc-100 outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input de Referência Rápida */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleQuickRef(quickRef);
          }}
          className="relative"
        >
          <Input
            value={quickRef}
            onChange={(e) => setQuickRef(e.target.value)}
            placeholder="Ir para referência (ex: João 3:16)…"
            className="h-9 pl-8 pr-12 text-xs bg-zinc-800/80 border-zinc-700 text-zinc-100"
          />
          <Sparkles className="size-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-7 text-xs text-emerald-400 font-bold px-2"
          >
            Ir
          </Button>
        </form>

        {/* Input de Busca por Palavras */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearchWords(wordQuery);
          }}
          className="relative"
        >
          <Input
            value={wordQuery}
            onChange={(e) => setWordQuery(e.target.value)}
            placeholder="Pesquisar texto da Bíblia…"
            className="h-9 pl-8 pr-8 text-xs bg-zinc-800/80 border-zinc-700 text-zinc-100"
          />
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
          {wordQuery && (
            <button
              type="button"
              onClick={() => {
                setWordQuery("");
                setIsSearching(false);
              }}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Breadcrumb de Seleção (Livro > Capítulo) */}
      {!isSearching && (
        <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode("books")}
            className={`flex-1 py-1.5 px-2 rounded text-center truncate transition-colors ${
              viewMode === "books"
                ? "bg-emerald-500/20 text-emerald-300 font-bold"
                : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {activeBook?.name ?? "Selecione o Livro"}
          </button>
          <ChevronRight className="size-3.5 text-zinc-600 shrink-0" />
          <button
            type="button"
            onClick={() => setViewMode("chapters")}
            className={`w-20 py-1.5 px-2 rounded text-center transition-colors ${
              viewMode === "chapters"
                ? "bg-emerald-500/20 text-emerald-300 font-bold"
                : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Capítulo {activeChapter}
          </button>
          <ChevronRight className="size-3.5 text-zinc-600 shrink-0" />
          <button
            type="button"
            onClick={() => setViewMode("reader")}
            className={`w-20 py-1.5 px-2 rounded text-center transition-colors ${
              viewMode === "reader"
                ? "bg-emerald-500/20 text-emerald-300 font-bold"
                : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Versículos
          </button>
        </div>
      )}

      {/* Vista de Comparação de Versões */}
      {isComparing && compareTarget && (
        <div className="rounded-xl border border-emerald-500/40 bg-zinc-900/90 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Columns2 className="size-4" />
              Comparando {compareTarget.bookName} {compareTarget.chapter}:{compareTarget.verse}
            </span>
            <button
              type="button"
              onClick={() => setIsComparing(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {compareResults.map((item) => (
              <div
                key={item.versionId}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">
                    {item.versionName} ({item.versionId})
                  </span>
                  {item.verse && (
                    <Button
                      size="sm"
                      className="h-6 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => {
                        void handlePresent(item.verse!, item.versionId);
                        setIsComparing(false);
                      }}
                    >
                      Projetar
                    </Button>
                  )}
                </div>
                {item.verse ? (
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {item.verse.text}
                  </p>
                ) : (
                  <p className="text-xs italic text-zinc-500">Não disponível</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultados de Pesquisa por Palavra */}
      {isSearching ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-400">
              {searchResults.length} versículo(s) encontrado(s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearching(false)}
              className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Fechar
            </Button>
          </div>

          <div className="space-y-1.5">
            {searchResults.map((item) => (
              <button
                key={`${item.bookId}-${item.chapter}-${item.verse}`}
                type="button"
                onClick={() => {
                  setActiveBookId(item.bookId);
                  setActiveChapter(item.chapter);
                  setViewMode("reader");
                  setIsSearching(false);
                  void handlePresent({
                    id: 0,
                    bookId: item.bookId,
                    chapter: item.chapter,
                    verse: item.verse,
                    text: item.text,
                  });
                }}
                className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 hover:border-emerald-500/60 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-400">
                    {item.bookName} {item.chapter}:{item.verse}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {item.version}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans line-clamp-2">
                  {item.text}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : viewMode === "books" ? (
        /* Seletor de Livros */
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
          <div className="flex rounded-lg bg-zinc-800/60 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTestament("all")}
              className={`flex-1 py-1 rounded text-center transition-colors ${
                testament === "all"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTestament("ot")}
              className={`flex-1 py-1 rounded text-center transition-colors ${
                testament === "ot"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Antigo (39)
            </button>
            <button
              type="button"
              onClick={() => setTestament("nt")}
              className={`flex-1 py-1 rounded text-center transition-colors ${
                testament === "nt"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Novo (27)
            </button>
          </div>

          <Input
            value={bookSearch}
            onChange={(e) => setBookSearch(e.target.value)}
            placeholder="Filtrar livros…"
            className="h-8 text-xs bg-zinc-800/80 border-zinc-700 text-zinc-100"
          />

          <div className="grid grid-cols-2 gap-1.5 max-h-96 overflow-y-auto">
            {filteredBooks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setActiveBookId(b.id);
                  setActiveChapter(1);
                  setViewMode("chapters");
                }}
                className={`p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                  b.id === activeBookId
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{b.name}</span>
                  <span className="text-[10px] text-zinc-500">{b.chapterCount}c</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : viewMode === "chapters" ? (
        /* Seletor de Capítulos */
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-200">
              {activeBook?.name} · Selecione o capítulo
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto">
            {activeBook &&
              Array.from({ length: activeBook.chapterCount }, (_, i) => i + 1).map(
                (cNum) => (
                  <button
                    key={cNum}
                    type="button"
                    onClick={() => {
                      setActiveChapter(cNum);
                      setViewMode("reader");
                    }}
                    className={`aspect-square rounded-lg flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                      cNum === activeChapter
                        ? "bg-emerald-500 text-black shadow-xs ring-2 ring-emerald-400"
                        : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    }`}
                  >
                    {cNum}
                  </button>
                ),
              )}
          </div>
        </div>
      ) : (
        /* Modo Leitura & Versículos */
        <div className="space-y-2">
          {verses.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              {loading ? "Carregando versículos..." : "Nenhum versículo carregado."}
            </div>
          ) : (
            verses.map((verse) => {
              const parts = splitVerseText(verse.text, 220);
              const isSplit = parts.length > 1;
              const isSelected = selectedVerseNum === verse.verse;
              const isLive =
                isCurrentLiveVerse &&
                (live?.content.id?.startsWith(
                  `bible-${activeBookId}-${activeChapter}-${verse.verse}`,
                ) ||
                  Boolean(
                    live?.content.title?.includes(
                      `${activeBook?.name} ${activeChapter}:${verse.verse}`,
                    ),
                  ));

              return (
                <div
                  key={verse.id || verse.verse}
                  onClick={() => void handlePresent(verse, undefined, 0)}
                  className={`rounded-xl border p-3 transition-all cursor-pointer ${
                    isLive
                      ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500"
                      : isSelected
                      ? "border-emerald-500/50 bg-zinc-900"
                      : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-850"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isLive
                          ? "bg-emerald-500 text-black font-extrabold"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {verse.verse}
                    </span>

                    <div className="flex items-center gap-2">
                      {isLive && (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <Radio className="size-3 animate-pulse" /> AO VIVO
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleOpenCompare(verse.verse);
                        }}
                        className="text-zinc-500 hover:text-zinc-200 p-1 rounded"
                        title="Comparar versões deste versículo"
                      >
                        <Columns2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <p
                    className={`text-xs leading-relaxed font-sans ${
                      isLive ? "font-semibold text-zinc-100" : "text-zinc-300"
                    }`}
                  >
                    {verse.text}
                  </p>

                  {isSplit && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/80">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Slides ({parts.length}):
                      </span>
                      {parts.map((_, pIdx) => {
                        const partNum = pIdx + 1;
                        const isPartLive =
                          isLive &&
                          Boolean(live?.content.title?.includes(`(${partNum}/${parts.length})`));

                        return (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handlePresent(verse, undefined, pIdx);
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                              isPartLive
                                ? "bg-emerald-500 text-black shadow-xs font-extrabold"
                                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/50"
                            }`}
                          >
                            Parte {partNum}/{parts.length}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
