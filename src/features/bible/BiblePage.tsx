import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Columns2,
  EyeOff,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Play,
  Radio,
  Scissors,
  Search,
  Settings2,
  Sparkles,
  Upload,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PreviewZoomControls } from "@/components/PreviewZoomControls";
import { SlideThumbnail } from "@/components/SlideThumbnail";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { buildScriptureSlide } from "@/core/lib/biblePresentation";
import { cn } from "@/core/lib/utils";
import { usePersistentViewMode } from "@/core/lib/usePersistentViewMode";
import { usePersistentNumber } from "@/core/lib/usePersistentNumber";
import {
  BIBLE_PREVIEW_GRID,
  previewGridStyle,
} from "@/core/lib/previewGrid";
import { BOOKS_VIEW_DEFAULT, BOOKS_VIEW_MODES } from "@/core/lib/viewMode";
import { usePublicThemeResolver } from "@/features/slide-themes/usePublicThemeResolver";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { clearAssetDragData, setAssetDragData } from "@/features/media-library/dnd";
import { addItemToActiveSetlist } from "@/features/command-palette/addToSetlist";
import { formatBibleVersionLabel } from "./bibleUtils";
import { useBibleStore } from "./store";
import { usePresentationStore } from "../presentation/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompareModal } from "./CompareModal";
import { ManageBibleVersionsDialog } from "./ManageBibleVersionsDialog";
import { pickBibleFiles } from "./bibleFilePicker";

export function BiblePage() {
  const versions = useBibleStore((s) => s.versions);
  const activeVersionId = useBibleStore((s) => s.activeVersionId);
  const books = useBibleStore((s) => s.books);
  const activeBookId = useBibleStore((s) => s.activeBookId);
  const activeChapter = useBibleStore((s) => s.activeChapter);
  const verses = useBibleStore((s) => s.verses);
  const selectedVerseNum = useBibleStore((s) => s.selectedVerseNum);
  const activePartIndex = useBibleStore((s) => s.activePartIndex);
  const liveVerseKey = useBibleStore((s) => s.liveVerseKey);
  const splitLongVerses = useBibleStore((s) => s.splitLongVerses);
  const splitThresholdChars = useBibleStore((s) => s.splitThresholdChars);
  const setSplitLongVerses = useBibleStore((s) => s.setSplitLongVerses);
  const getVerseParts = useBibleStore((s) => s.getVerseParts);

  const testamentFilter = useBibleStore((s) => s.testamentFilter);
  const bookFilter = useBibleStore((s) => s.bookFilter);
  const setTestamentFilter = useBibleStore((s) => s.setTestamentFilter);
  const setBookFilter = useBibleStore((s) => s.setBookFilter);

  const searchQuery = useBibleStore((s) => s.searchQuery);
  const searchResults = useBibleStore((s) => s.searchResults);
  const isSearching = useBibleStore((s) => s.isSearching);
  const loading = useBibleStore((s) => s.loading);

  const loadInitial = useBibleStore((s) => s.loadInitial);
  const setActiveVersion = useBibleStore((s) => s.setActiveVersion);
  const importBibleFiles = useBibleStore((s) => s.importBibleFiles);
  const selectBook = useBibleStore((s) => s.selectBook);
  const selectChapter = useBibleStore((s) => s.selectChapter);
  const selectVerse = useBibleStore((s) => s.selectVerse);
  const presentCurrentVerse = useBibleStore((s) => s.presentCurrentVerse);
  const presentVerse = useBibleStore((s) => s.presentVerse);
  const presentNextVerse = useBibleStore((s) => s.presentNextVerse);
  const presentPrevVerse = useBibleStore((s) => s.presentPrevVerse);
  const searchWords = useBibleStore((s) => s.searchWords);
  const clearSearch = useBibleStore((s) => s.clearSearch);
  const openCompare = useBibleStore((s) => s.openCompare);
  const jumpToReference = useBibleStore((s) => s.jumpToReference);
  const goToVerse = useBibleStore((s) => s.goToVerse);

  const clearLive = usePresentationStore((s) => s.clearLive);
  const liveSlide = usePresentationStore((s) => s.live);
  const [versesView, setVersesView] = usePersistentViewMode(
    "open_presenter_bible_verses_view",
    "list",
    ["list", "slides", "text"] as const,
  );
  const [verseZoom, setVerseZoom] = usePersistentNumber(
    "open_presenter_bible_verses_zoom",
    BIBLE_PREVIEW_GRID.defaultLevel,
    BIBLE_PREVIEW_GRID.minLevel,
    BIBLE_PREVIEW_GRID.maxLevel,
  );
  const [booksView, setBooksView] = usePersistentViewMode(
    "open_presenter_bible_books_view",
    BOOKS_VIEW_DEFAULT,
    BOOKS_VIEW_MODES,
  );
  const resolveTheme = usePublicThemeResolver();

  const [quickRefInput, setQuickRefInput] = useState("");
  const [wordSearchInput, setWordSearchInput] = useState("");
  const [isManageVersionsOpen, setIsManageVersionsOpen] = useState(false);
  const [selectedVerseNums, setSelectedVerseNums] = useState<number[]>([]);
  const versesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    setSelectedVerseNums(selectedVerseNum ? [selectedVerseNum] : []);
  }, [activeBookId, activeChapter]);

  const activeBook = useMemo(
    () => books.find((b) => b.id === activeBookId),
    [books, activeBookId],
  );

  const handleVerseClick = (e: React.MouseEvent, verseNum: number, partIndex = 0) => {
    if (
      document.activeElement instanceof HTMLElement &&
      (document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA")
    ) {
      document.activeElement.blur();
    }

    if (e.metaKey || e.ctrlKey) {
      setSelectedVerseNums((prev) => {
        const exists = prev.includes(verseNum);
        if (exists) {
          const next = prev.filter((v) => v !== verseNum);
          return next;
        }
        return [...prev, verseNum].sort((a, b) => a - b);
      });
      selectVerse(verseNum, partIndex);
    } else if (e.shiftKey && selectedVerseNums.length > 0) {
      const lastNum = selectedVerseNums[selectedVerseNums.length - 1];
      const min = Math.min(lastNum, verseNum);
      const max = Math.max(lastNum, verseNum);
      const range: number[] = [];
      for (let i = min; i <= max; i++) {
        range.push(i);
      }
      setSelectedVerseNums(range);
      selectVerse(verseNum, partIndex);
    } else {
      setSelectedVerseNums([verseNum]);
      selectVerse(verseNum, partIndex);
    }
  };

  const handleAddVersesToSetlist = (verseNumsToAdd?: number[]) => {
    const nums =
      verseNumsToAdd && verseNumsToAdd.length > 0
        ? verseNumsToAdd
        : selectedVerseNums.length > 0
        ? selectedVerseNums
        : selectedVerseNum
        ? [selectedVerseNum]
        : [];

    if (nums.length === 0) {
      toast.error("Nenhum versículo selecionado.");
      return;
    }

    const sorted = [...nums].sort((a, b) => a - b);
    const bookName = activeBook?.name ?? `Livro ${activeBookId}`;

    for (const vNum of sorted) {
      addItemToActiveSetlist({
        scripture: {
          versionId: activeVersionId,
          bookId: activeBookId,
          bookName,
          chapter: activeChapter,
          verse: vNum,
          part: 0,
          totalParts: 1,
        },
      });
    }

    const rangeLabel =
      sorted.length > 1
        ? `${bookName} ${activeChapter}:${sorted[0]}–${sorted[sorted.length - 1]}`
        : `${bookName} ${activeChapter}:${sorted[0]}`;
    toast.success(`"${rangeLabel}" adicionado à programação!`);
  };

  const handleVerseDragStart = (e: React.DragEvent, verseNum: number) => {
    const bookName = activeBook?.name ?? `Livro ${activeBookId}`;
    const versesToDrag =
      selectedVerseNums.includes(verseNum) && selectedVerseNums.length > 1
        ? [...selectedVerseNums].sort((a, b) => a - b)
        : [verseNum];

    setAssetDragData(e, {
      type: "scripture",
      versionId: activeVersionId,
      bookId: activeBookId,
      bookName,
      chapter: activeChapter,
      verses: versesToDrag,
    });
  };

  // Filtra livros por testamento e texto
  const filteredBooks = useMemo(() => {
    const q = bookFilter.trim().toLowerCase();
    return books.filter((b) => {
      if (testamentFilter === "ot" && b.testamentReferenceId !== 1) return false;
      if (testamentFilter === "nt" && b.testamentReferenceId !== 2) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.abbrev.toLowerCase().includes(q)
      );
    });
  }, [books, testamentFilter, bookFilter]);

  const verseCards = useMemo(() => {
    if (versesView === "list" || !activeBook || !activeVersionId) return [];
    return verses.flatMap((verse) => {
      const parts = getVerseParts(verse.text);
      return parts.map((partText, partIndex) => {
        const slide = buildScriptureSlide({
          versionId: activeVersionId,
          bookId: activeBook.id,
          bookName: activeBook.name,
          chapter: activeChapter,
          verse: verse.verse,
          text: partText,
          part: partIndex,
          totalParts: parts.length,
        });
        return {
          verse,
          partIndex,
          totalParts: parts.length,
          slide,
          theme: resolveTheme(slide),
        };
      });
    });
  }, [
    versesView,
    verses,
    activeBook,
    activeVersionId,
    activeChapter,
    getVerseParts,
    resolveTheme,
    splitLongVerses,
    splitThresholdChars,
  ]);

  const isCurrentLiveScripture =
    liveSlide.content.kind === "scripture" && !liveSlide.cleared && !liveSlide.blackout;

  // Rola até o versículo selecionado se houver
  useEffect(() => {
    if (selectedVerseNum && versesContainerRef.current) {
      const el = document.querySelector<HTMLElement>(
        `[data-verse="${selectedVerseNum}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedVerseNum, versesView]);

  // Teclas de atalho para selecionar e apresentar versículos
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"]')
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        void presentCurrentVerse();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentNum = useBibleStore.getState().selectedVerseNum;
        const allVerses = useBibleStore.getState().verses;
        const nextNum =
          currentNum === null ? 1 : Math.min(allVerses.length, currentNum + 1);
        selectVerse(nextNum);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentNum = useBibleStore.getState().selectedVerseNum;
        const prevNum =
          currentNum === null ? 1 : Math.max(1, currentNum - 1);
        selectVerse(prevNum);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isCurrentLiveScripture) {
          void presentNextVerse();
        } else {
          const currentNum = useBibleStore.getState().selectedVerseNum;
          const allVerses = useBibleStore.getState().verses;
          const nextNum =
            currentNum === null ? 1 : Math.min(allVerses.length, currentNum + 1);
          selectVerse(nextNum);
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isCurrentLiveScripture) {
          void presentPrevVerse();
        } else {
          const currentNum = useBibleStore.getState().selectedVerseNum;
          const prevNum =
            currentNum === null ? 1 : Math.max(1, currentNum - 1);
          selectVerse(prevNum);
        }
        return;
      }

      if (e.key === "Escape") {
        if (isSearching) {
          clearSearch();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    presentCurrentVerse,
    presentNextVerse,
    presentPrevVerse,
    selectVerse,
    isCurrentLiveScripture,
    isSearching,
    clearSearch,
  ]);

  async function handleImport() {
    const paths = await pickBibleFiles(true);
    if (paths.length === 0) return;
    await importBibleFiles(paths);
  }

  function handleQuickRefSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = quickRefInput.trim();
    if (!clean) return;
    (document.activeElement as HTMLElement | null)?.blur();
    void jumpToReference(clean);
  }

  function handleWordSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = wordSearchInput.trim();
    if (!clean) {
      clearSearch();
      return;
    }
    void searchWords(clean);
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background select-none">
      {/* Top Bar: Seleção de versão, busca de referência rápida, busca por palavras e ações */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 gap-3">
        {/* Seletor de Versão e Importação */}
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary shrink-0" />
          {versions.length > 0 ? (
            <Select
              value={activeVersionId}
              onValueChange={(val) => void setActiveVersion(val)}
            >
              <SelectTrigger className="w-[200px] h-9 text-xs font-semibold cursor-pointer">
                <SelectValue placeholder="Selecione a versão">
                  {versions.find((v) => v.id === activeVersionId)
                    ? formatBibleVersionLabel(versions.find((v) => v.id === activeVersionId)!)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {formatBibleVersionLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
              Nenhuma versão instalada
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                title="Mais ações da Bíblia"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => void handleImport()}>
                <Upload className="mr-2 size-4" />
                Importar Bíblia…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsManageVersionsOpen(true)}>
                <Settings2 className="mr-2 size-4" />
                Gerenciar versões…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Campo Central: Referência Rápida (Ex: Jo 3:16) */}
        <form onSubmit={handleQuickRefSubmit} className="flex-1 max-w-sm">
          <div className="relative">
            <Input
              value={quickRefInput}
              onChange={(e) => setQuickRefInput(e.target.value)}
              placeholder="Ex: João 3:16 ou Sl 23 (Enter)"
              className="h-9 pl-8 pr-12 text-xs font-medium bg-background"
            />
            <Sparkles className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 text-[11px] px-2 text-primary font-semibold"
            >
              Ir
            </Button>
          </div>
        </form>


        {/* Campo Direito: Pesquisa por Palavras */}
        <form onSubmit={handleWordSearchSubmit} className="flex-1 max-w-xs">
          <div className="relative">
            <Input
              value={wordSearchInput}
              onChange={(e) => setWordSearchInput(e.target.value)}
              placeholder="Pesquisar por palavras…"
              className="h-9 pl-8 pr-8 text-xs bg-background"
            />
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            {wordSearchInput && (
              <button
                type="button"
                onClick={() => {
                  setWordSearchInput("");
                  clearSearch();
                }}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Controles de Projeção */}
        <div className="flex items-center gap-2">
          {selectedVerseNum && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openCompare(selectedVerseNum)}
              className="h-9 text-xs cursor-pointer"
              title="Comparar o versículo selecionado em todas as versões instaladas"
            >
              <Columns2 className="size-3.5 mr-1 text-primary" />
              Comparar Versões
            </Button>
          )}

          {isCurrentLiveScripture && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void clearLive()}
              className="h-9 text-xs cursor-pointer"
            >
              <EyeOff className="size-3.5 mr-1" />
              Limpar Projeção
            </Button>
          )}
        </div>
      </header>

      {/* Se estiver no modo de busca por palavra, mostra resultados */}
      {isSearching ? (
        <section className="flex flex-1 flex-col overflow-hidden bg-background p-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Search className="size-4 text-primary" />
                Resultados para: "{searchQuery}"
              </h2>
              <p className="text-xs text-muted-foreground">
                {searchResults.length} versículo(s) encontrado(s) na versão {activeVersionId}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearSearch()}
              className="text-xs"
            >
              <X className="size-3.5 mr-1" /> Voltar aos Livros
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {searchResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum versículo encontrado com o termo pesquisado.
              </div>
            ) : (
              searchResults.map((item) => (
                <div
                  key={`${item.bookId}-${item.chapter}-${item.verse}`}
                  onClick={() => {
                    void goToVerse(item.bookId, item.chapter, item.verse, false);
                  }}
                  onDoubleClick={() => {
                    void goToVerse(item.bookId, item.chapter, item.verse, true);
                  }}
                  className="group rounded-lg border border-border/60 bg-card p-3 hover:border-primary/60 hover:bg-muted/40 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-primary">
                      {item.bookName} {item.chapter}:{item.verse}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {item.version}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void goToVerse(item.bookId, item.chapter, item.verse, true);
                        }}
                        className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                        title="Projetar versículo imediatamente"
                      >
                        <Play className="size-2.5 fill-current" />
                        Projetar
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                    {item.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        /* Layout Principal 3 Colunas: [Livros] | [Capítulos] | [Versículos] */
        <main className="flex flex-1 overflow-hidden">
          {/* Coluna 1: Livros da Bíblia */}
          <section
            className="flex w-64 shrink-0 flex-col border-r border-border bg-card/25"
          >
            <div className="flex h-9 items-center justify-between border-b border-border/60 px-3">
              <span className="text-xs font-bold text-foreground">Livros</span>
              <ViewModeToggle
                value={booksView}
                onChange={setBooksView}
                options={[
                  { value: "list", label: "Lista", icon: List },
                  { value: "table", label: "Tabela", icon: LayoutGrid },
                ]}
              />
            </div>
            {/* Filtros OT / NT */}
            <div className="p-2 border-b border-border/60 space-y-2">
              <div className="flex rounded-lg bg-muted/60 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTestamentFilter("all")}
                  className={`flex-1 py-1 text-center rounded-md transition-all cursor-pointer ${
                    testamentFilter === "all"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({books.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTestamentFilter("ot")}
                  className={`flex-1 py-1 text-center rounded-md transition-all cursor-pointer ${
                    testamentFilter === "ot"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Antigo (39)
                </button>
                <button
                  type="button"
                  onClick={() => setTestamentFilter("nt")}
                  className={`flex-1 py-1 text-center rounded-md transition-all cursor-pointer ${
                    testamentFilter === "nt"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Novo (27)
                </button>
              </div>

              <Input
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                placeholder="Filtrar livros…"
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* Lista de Livros */}
            {booksView === "table" ? (
              <div className="flex-1 overflow-y-auto p-1.5">
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(2.25rem, 1fr))",
                  }}
                >
                  {filteredBooks.map((book) => {
                    const isActive = book.id === activeBookId;
                    const isOld = book.testamentReferenceId === 1;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        title={book.name}
                        onClick={() => void selectBook(book.id)}
                        className={cn(
                          "flex min-h-7 items-center justify-center rounded border px-1 font-mono text-[10px] font-semibold transition-colors cursor-pointer",
                          isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : isOld
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-700 hover:border-amber-500/60 dark:text-amber-300"
                            : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:border-emerald-500/60 dark:text-emerald-300",
                        )}
                      >
                        {book.abbrev}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {filteredBooks.map((book) => {
                  const isActive = book.id === activeBookId;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => void selectBook(book.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className={`text-[11px] font-mono shrink-0 ${
                            isActive
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {book.abbrev}
                        </span>
                        <span className="truncate">{book.name}</span>
                      </span>
                      <span
                        className={`text-[10px] rounded px-1 shrink-0 ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {book.chapterCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Coluna 2: Capítulos do Livro Selecionado */}
          <section className="flex w-52 shrink-0 flex-col border-r border-border bg-card/10">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3 bg-muted/20">
              <span className="text-xs font-bold text-foreground">
                Capítulos · {activeBook?.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Total: {activeBook?.chapterCount ?? 0}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-4 gap-1.5">
                {activeBook &&
                  Array.from({ length: activeBook.chapterCount }, (_, i) => i + 1).map(
                    (chapNum) => {
                      const isActive = chapNum === activeChapter;
                      return (
                        <button
                          key={chapNum}
                          type="button"
                          onClick={() => void selectChapter(chapNum)}
                          className={`flex aspect-square items-center justify-center rounded-md text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/40"
                              : "bg-muted/60 text-foreground hover:bg-muted hover:text-primary"
                          }`}
                        >
                          {chapNum}
                        </button>
                      );
                    },
                  )}
              </div>
            </div>
          </section>

          {/* Coluna 3: Lista de Versículos & Apresentação */}
          <section className="flex flex-1 flex-col overflow-hidden bg-background">
            {/* Header da Coluna de Versículos */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {activeBook?.name} {activeChapter}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({verses.length} versículos)
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">
                  {activeVersionId}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <ViewModeToggle
                  value={versesView}
                  onChange={setVersesView}
                  options={[
                    { value: "list", label: "Lista", icon: List },
                    { value: "slides", label: "Slides", icon: LayoutGrid },
                    { value: "text", label: "Texto", icon: AlignLeft },
                  ]}
                />
                {versesView !== "list" && (
                  <PreviewZoomControls
                    config={BIBLE_PREVIEW_GRID}
                    level={verseZoom}
                    onChange={setVerseZoom}
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={splitLongVerses ? "secondary" : "ghost"}
                  onClick={() => setSplitLongVerses(!splitLongVerses)}
                  className={`h-7 text-[11px] gap-1.5 cursor-pointer font-medium ${
                    splitLongVerses
                      ? "border border-primary/40 bg-primary/10 text-primary shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Dividir versículos longos automaticamente em partes (1/2, 2/2) para garantir letras grandes e legíveis no telão"
                >
                  <Scissors className="size-3" />
                  <span>Dividir versículos longos</span>
                </Button>
                <div className="h-3.5 w-px bg-border/60" />
                <span className="text-xs text-muted-foreground hidden lg:inline">
                  Dica: Clique para selecionar · Enter para projetar
                </span>
              </div>
            </div>

            {/* Lista dos Versículos */}
            <div
              ref={versesContainerRef}
              className={cn(
                "flex-1 overflow-y-auto p-4",
                versesView === "list" && "space-y-2.5",
              )}
            >
              {loading && verses.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : verses.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {versions.length === 0
                    ? "Importe uma Bíblia usando o botão acima para começar a exibir versículos."
                    : "Nenhum versículo encontrado neste capítulo."}
                </div>
              ) : versesView !== "list" ? (
                <div
                  className="grid gap-2"
                  style={previewGridStyle(BIBLE_PREVIEW_GRID, verseZoom)}
                >
                  {verseCards.map(
                    ({ verse, partIndex, totalParts, slide, theme }) => {
                      const isLive =
                        isCurrentLiveScripture && liveVerseKey === slide.id;
                      const isMultiSelected = selectedVerseNums.includes(verse.verse);
                      const isSelected =
                        (selectedVerseNum === verse.verse &&
                          activePartIndex === partIndex) ||
                        isMultiSelected;

                      return (
                        <ContextMenu key={slide.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              role="button"
                              tabIndex={0}
                              draggable
                              onDragStart={(e) => handleVerseDragStart(e, verse.verse)}
                              onDragEnd={() => clearAssetDragData()}
                              data-verse={verse.verse}
                              onClick={(e) => handleVerseClick(e, verse.verse, partIndex)}
                              onDoubleClick={() =>
                                void presentVerse(
                                  verse,
                                  undefined,
                                  partIndex,
                                )
                              }
                              className={cn(
                                "group flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-all cursor-pointer select-none",
                                isLive
                                  ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40"
                                  : isMultiSelected
                                  ? "border-primary bg-primary/15 ring-2 ring-primary/50 shadow-xs"
                                  : isSelected
                                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                  : "border-border/80 bg-card/70 hover:border-primary/50",
                              )}
                              title="Arraste para a Programação · Cmd/Ctrl+Clique: selecionar múltiplos"
                            >
                              {versesView === "slides" ? (
                                <SlideThumbnail
                                  content={slide}
                                  theme={theme}
                                  className="pointer-events-none"
                                />
                              ) : (
                                <p className="min-h-16 whitespace-pre-line text-[11px] leading-snug text-foreground/90">
                                  {slide.lines.join("\n")}
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-1 px-0.5">
                                <span className="truncate text-[10px] font-semibold text-primary">
                                  {slide.section}
                                </span>
                                {totalParts > 1 && (
                                  <Badge
                                    variant="outline"
                                    className="h-4 px-1 text-[9px]"
                                  >
                                    {partIndex + 1}/{totalParts}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </ContextMenuTrigger>

                          <ContextMenuContent className="w-56 text-xs">
                            <ContextMenuItem
                              onSelect={() => {
                                const targetNums = selectedVerseNums.includes(verse.verse)
                                  ? selectedVerseNums
                                  : [verse.verse];
                                handleAddVersesToSetlist(targetNums);
                              }}
                            >
                              <Plus className="size-3.5 mr-2 text-primary" />
                              <span>
                                {selectedVerseNums.length > 1 && selectedVerseNums.includes(verse.verse)
                                  ? `Adicionar ${selectedVerseNums.length} versículos ao Setlist`
                                  : "Adicionar à Programação"}
                              </span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() =>
                                void presentVerse(verse, undefined, partIndex)
                              }
                            >
                              <Play className="size-3.5 mr-2 text-emerald-500" />
                              <span>Projetar ao Vivo (Enter)</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                selectVerse(verse.verse);
                                void openCompare(verse.verse);
                              }}
                            >
                              <Columns2 className="size-3.5 mr-2 text-muted-foreground" />
                              <span>Comparar Versões</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    },
                  )}
                </div>
              ) : (
                verses.map((verse) => {
                  const parts = getVerseParts(verse.text);
                  const isSplit = parts.length > 1;
                  const baseVerseKey = `bible-${activeBookId}-${activeChapter}-${verse.verse}`;
                  const isLiveThisVerse =
                    Boolean(
                      liveVerseKey &&
                        (liveVerseKey === baseVerseKey ||
                          liveVerseKey.startsWith(`${baseVerseKey}#`)),
                    ) && isCurrentLiveScripture;
                  const isMultiSelected = selectedVerseNums.includes(verse.verse);
                  const isSelected = selectedVerseNum === verse.verse || isMultiSelected;

                  return (
                    <ContextMenu key={verse.id || verse.verse}>
                      <ContextMenuTrigger asChild>
                        <div
                          draggable
                          onDragStart={(e) => handleVerseDragStart(e, verse.verse)}
                          onDragEnd={() => clearAssetDragData()}
                          id={`verse-row-${verse.verse}`}
                          data-verse={verse.verse}
                          onClick={(e) => handleVerseClick(e, verse.verse, 0)}
                          onDoubleClick={() => {
                            selectVerse(verse.verse, 0);
                            void presentVerse(verse, undefined, 0);
                          }}
                          className={`group relative flex items-start gap-3 rounded-xl border p-3.5 transition-all cursor-pointer select-none ${
                            isLiveThisVerse
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500"
                              : isMultiSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-xs"
                              : isSelected
                              ? "border-primary/80 bg-primary/5 shadow-xs"
                              : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
                          }`}
                          title="Arraste para a Programação · Cmd/Ctrl+Clique: selecionar múltiplos · Shift+Clique: intervalo"
                        >
                          {/* Número do Versículo */}
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                              isLiveThisVerse
                                ? "bg-emerald-500 text-black font-extrabold shadow-xs"
                                : isMultiSelected
                                ? "bg-primary text-primary-foreground font-bold"
                                : isSelected
                                ? "bg-primary text-primary-foreground font-bold"
                                : "bg-muted text-muted-foreground group-hover:bg-muted/80 group-hover:text-foreground"
                            }`}
                          >
                            {verse.verse}
                          </span>

                          {/* Texto do Versículo e Partes */}
                          <div className="flex-1 pr-16">
                            <p
                              className={`text-sm leading-relaxed font-sans ${
                                isLiveThisVerse
                                  ? "font-semibold text-foreground"
                                  : "text-foreground/90"
                              }`}
                            >
                              {verse.text}
                            </p>

                            {/* Partes do versículo quando dividido */}
                            {isSplit && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                  Slides ({parts.length}):
                                </span>
                                {parts.map((partText, pIdx) => {
                                  const partNum = pIdx + 1;
                                  const partKey = `${baseVerseKey}#${partNum}`;
                                  const isPartLive =
                                    liveVerseKey === partKey && isCurrentLiveScripture;
                                  const isPartSelected =
                                    isSelected && activePartIndex === pIdx;

                                  return (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectVerse(verse.verse, pIdx);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        selectVerse(verse.verse, pIdx);
                                        void presentVerse(verse, undefined, pIdx);
                                      }}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                        isPartLive
                                          ? "bg-emerald-500 text-black shadow-xs ring-1 ring-emerald-500 font-extrabold"
                                          : isPartSelected
                                          ? "bg-primary text-primary-foreground shadow-xs"
                                          : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                                      }`}
                                      title={`Parte ${partNum}/${parts.length}: "${partText.slice(0, 50)}..." (Duplo clique para projetar)`}
                                    >
                                      <span>{partNum}/{parts.length}</span>
                                      {isPartLive && <Radio className="size-2.5 animate-pulse" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Badges e Ações na Direita */}
                          <div className="absolute right-3 top-3 flex items-center gap-1.5">
                            {isLiveThisVerse ? (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                                <Radio className="size-3" />
                                AO VIVO{isSplit ? ` (${activePartIndex + 1}/${parts.length})` : ""}
                              </span>
                            ) : isSelected ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void presentVerse(verse, undefined, activePartIndex);
                                }}
                                className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-semibold shadow-xs flex items-center gap-1"
                                title="Projetar versículo agora (ou pressione Enter)"
                              >
                                <Play className="size-2.5 fill-current" />
                                Projetar (Enter)
                              </Button>
                            ) : null}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectVerse(verse.verse);
                                void openCompare(verse.verse);
                              }}
                              className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Comparar versões deste versículo"
                            >
                              <Columns2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56 text-xs">
                        <ContextMenuItem
                          onSelect={() => {
                            const targetNums = selectedVerseNums.includes(verse.verse)
                              ? selectedVerseNums
                              : [verse.verse];
                            handleAddVersesToSetlist(targetNums);
                          }}
                        >
                          <Plus className="size-3.5 mr-2 text-primary" />
                          <span>
                            {selectedVerseNums.length > 1 && selectedVerseNums.includes(verse.verse)
                              ? `Adicionar ${selectedVerseNums.length} versículos ao Setlist`
                              : "Adicionar à Programação"}
                          </span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            selectVerse(verse.verse, 0);
                            void presentVerse(verse, undefined, 0);
                          }}
                        >
                          <Play className="size-3.5 mr-2 text-emerald-500" />
                          <span>Projetar ao Vivo (Enter)</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            selectVerse(verse.verse);
                            void openCompare(verse.verse);
                          }}
                        >
                          <Columns2 className="size-3.5 mr-2 text-muted-foreground" />
                          <span>Comparar Versões</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              )}
            </div>

            {/* Barra de Múltiplos Versículos Selecionados */}
            {selectedVerseNums.length > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary/10 border-t border-primary/30 shrink-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
                    {selectedVerseNums.length} versículos selecionados
                  </Badge>
                  <span className="text-xs font-medium text-foreground">
                    {activeBook?.name} {activeChapter}:{Math.min(...selectedVerseNums)}–{Math.max(...selectedVerseNums)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedVerseNums([])}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Limpar seleção
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddVersesToSetlist()}
                    className="h-7 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    <Plus className="size-3" />
                    Adicionar ao Setlist
                  </Button>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar: Navegação Rápida entre versículos */}
            {verses.length > 0 && (
              <footer className="flex h-12 shrink-0 items-center justify-between border-t border-border/60 bg-card/60 px-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void presentPrevVerse()}
                    disabled={!selectedVerseNum || selectedVerseNum <= 1}
                    className="h-8 text-xs cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5 mr-1" />
                    Anterior (←)
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void presentNextVerse()}
                    disabled={!selectedVerseNum || selectedVerseNum >= verses.length}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Próximo (→)
                    <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {selectedVerseNum && (
                    <span className="text-xs text-muted-foreground font-medium">
                      Selecionado:{" "}
                      <strong className="text-foreground">
                        {activeBook?.name} {activeChapter}:{selectedVerseNum}
                      </strong>
                    </span>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddVersesToSetlist()}
                    className="h-8 text-xs font-semibold cursor-pointer gap-1"
                    title="Adicionar versículo(s) à programação ativa"
                  >
                    <Plus className="size-3" />
                    + Setlist
                  </Button>

                  {selectedVerseNum &&
                    (!isCurrentLiveScripture ||
                      liveVerseKey !==
                        `bible-${activeBookId}-${activeChapter}-${selectedVerseNum}`) && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void presentCurrentVerse()}
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ml-1"
                      >
                        <Play className="size-3 mr-1 fill-current" />
                        Projetar Versículo {selectedVerseNum} (Enter)
                      </Button>
                    )}
                </div>
              </footer>
            )}
          </section>
        </main>
      )}

      {/* Modal de Comparação de Versões */}
      <CompareModal />
      <ManageBibleVersionsDialog
        open={isManageVersionsOpen}
        onOpenChange={setIsManageVersionsOpen}
      />

    </div>
  );
}
