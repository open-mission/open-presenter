import { create } from "zustand";
import type {
  BibleBook,
  BibleSearchResult,
  BibleVerse,
  BibleVerseCompare,
  BibleVersion,
  ScriptureRef,
  SlideContent,
} from "@/core/types";
import {
  compareBibleVerse,
  deleteBible,
  getBibleBooks,
  getBibleChapter,
  importBible,
  listBibleVersions,
  searchBibleVerses,
} from "@/core/ipc/commands";
import {
  buildScriptureSlide,
  scriptureSlideId,
} from "@/core/lib/biblePresentation";
import { usePresentationStore } from "../presentation/store";
import { parseBibleReference } from "./bibleParser";
import { splitVerseText } from "@/core/lib/verseSplitter";
import { toast } from "sonner";

const SPLIT_VERSES_KEY = "open_presenter_bible_split_verses";
const SPLIT_THRESHOLD_KEY = "open_presenter_bible_split_threshold";

export interface BibleImportProgress {
  done: number;
  total: number;
  file: string;
}

export interface BibleImportError {
  file: string;
  error: string;
}

export interface BibleImportResult {
  imported: BibleVersion[];
  errors: BibleImportError[];
}

export interface ImportBibleFilesOptions {
  onProgress?: (progress: BibleImportProgress) => void;
  silent?: boolean;
}

interface BibleState {
  versions: BibleVersion[];
  activeVersionId: string;
  books: BibleBook[];
  activeBookId: number;
  activeChapter: number;
  verses: BibleVerse[];
  selectedVerseNum: number | null;
  activePartIndex: number;
  liveVerseKey: string | null;

  splitLongVerses: boolean;
  splitThresholdChars: number;

  testamentFilter: "all" | "ot" | "nt";
  bookFilter: string;

  searchQuery: string;
  searchResults: BibleSearchResult[];
  isSearching: boolean;

  compareTarget: { bookId: number; chapter: number; verse: number; bookName: string } | null;
  compareResults: BibleVerseCompare[];
  isComparing: boolean;

  loading: boolean;
  error: string | null;

  setSplitLongVerses(enabled: boolean): void;
  setSplitThresholdChars(chars: number): void;
  getVerseParts(text: string): string[];

  loadInitial(): Promise<void>;
  setActiveVersion(versionId: string): Promise<void>;
  importBibleFiles(
    paths: string[],
    options?: ImportBibleFilesOptions,
  ): Promise<BibleImportResult>;
  importBibleFile(
    path: string,
    customName?: string,
    options?: { silent?: boolean },
  ): Promise<boolean>;
  deleteBibleVersion(versionId: string): Promise<boolean>;

  setTestamentFilter(filter: "all" | "ot" | "nt"): void;
  setBookFilter(filter: string): void;

  selectBook(bookId: number): Promise<void>;
  selectChapter(chapter: number): Promise<void>;
  selectVerse(verseNum: number, partIndex?: number): void;

  presentCurrentVerse(): Promise<void>;
  presentVerse(verse: BibleVerse, versionOverride?: string, partIndex?: number): Promise<void>;
  presentReference(ref: ScriptureRef, partIndex?: number): Promise<void>;
  syncLiveScripture(ref: ScriptureRef): Promise<void>;
  presentNextVerse(): Promise<void>;
  presentPrevVerse(): Promise<void>;

  searchWords(query: string): Promise<void>;
  clearSearch(): void;

  openCompare(verseNum: number): Promise<void>;
  closeCompare(): void;
  presentFromCompare(compare: BibleVerseCompare): Promise<void>;

  jumpToReference(rawRef: string): Promise<boolean>;
  goToVerse(
    bookId: number,
    chapter: number,
    verseNum?: number,
    autoPresent?: boolean,
  ): Promise<void>;
}

export const useBibleStore = create<BibleState>((set, get) => ({
  versions: [],
  activeVersionId: "",
  books: [],
  activeBookId: 1, // Gênesis por padrão
  activeChapter: 1,
  verses: [],
  selectedVerseNum: null,
  activePartIndex: 0,
  liveVerseKey: null,

  splitLongVerses:
    typeof window !== "undefined"
      ? localStorage.getItem(SPLIT_VERSES_KEY) !== "false"
      : true,
  splitThresholdChars:
    typeof window !== "undefined"
      ? Number(localStorage.getItem(SPLIT_THRESHOLD_KEY)) || 220
      : 220,

  testamentFilter: "all",
  bookFilter: "",

  searchQuery: "",
  searchResults: [],
  isSearching: false,

  compareTarget: null,
  compareResults: [],
  isComparing: false,

  loading: false,
  error: null,

  setSplitLongVerses: (enabled: boolean) => {
    set({ splitLongVerses: enabled });
    try {
      localStorage.setItem(SPLIT_VERSES_KEY, String(enabled));
    } catch {}
  },

  setSplitThresholdChars: (chars: number) => {
    const val = Math.max(80, Math.min(800, chars));
    set({ splitThresholdChars: val });
    try {
      localStorage.setItem(SPLIT_THRESHOLD_KEY, String(val));
    } catch {}
  },

  getVerseParts: (text: string) => {
    const { splitLongVerses, splitThresholdChars } = get();
    if (!splitLongVerses) return [text];
    return splitVerseText(text, splitThresholdChars);
  },

  loadInitial: async () => {
    try {
      set({ loading: true, error: null });
      const versions = await listBibleVersions();
      set({ versions });

      if (versions.length > 0) {
        const currentActive = get().activeVersionId;
        const validActive = versions.some((v) => v.id === currentActive)
          ? currentActive
          : versions[0].id;

        await get().setActiveVersion(validActive);
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  setActiveVersion: async (versionId: string) => {
    try {
      set({ activeVersionId: versionId, loading: true, error: null });
      const books = await getBibleBooks(versionId);
      set({ books });

      const currentBookId = get().activeBookId;
      const validBookId = books.some((b) => b.id === currentBookId)
        ? currentBookId
        : (books[0]?.id ?? 1);

      const targetBook = books.find((b) => b.id === validBookId);
      const currentChapter = get().activeChapter;
      const validChapter =
        targetBook && currentChapter <= targetBook.chapterCount && currentChapter > 0
          ? currentChapter
          : 1;

      set({ activeBookId: validBookId, activeChapter: validChapter });
      const verses = await getBibleChapter(versionId, validBookId, validChapter);
      set({ verses });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  importBibleFile: async (path: string, customName?: string, options?) => {
    try {
      set({ loading: true, error: null });
      const imported = await importBible(path, customName);
      if (!options?.silent) {
        toast.success(`Bíblia "${imported.name}" importada com sucesso!`);
      }
      const versions = await listBibleVersions();
      set({ versions });
      await get().setActiveVersion(imported.id);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!options?.silent) {
        toast.error(`Falha ao importar Bíblia: ${msg}`);
      }
      set({ error: msg });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  importBibleFiles: async (paths, options) => {
    const imported: BibleVersion[] = [];
    const errors: BibleImportError[] = [];
    const total = paths.length;

    for (let index = 0; index < paths.length; index++) {
      const path = paths[index];
      const file = path.split(/[\\/]/).pop() ?? path;
      options?.onProgress?.({ done: index + 1, total, file });
      try {
        const version = await importBible(path);
        imported.push(version);
      } catch (err: unknown) {
        errors.push({
          file,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (imported.length > 0) {
      const versions = await listBibleVersions();
      set({ versions });
      if (!get().activeVersionId) {
        await get().setActiveVersion(imported[0].id);
      }
    }

    if (!options?.silent) {
      if (errors.length === 0) {
        toast.success(
          `${imported.length} ${imported.length === 1 ? "versão importada" : "versões importadas"}.`,
        );
      } else {
        toast.error(
          `${imported.length} importada(s), ${errors.length} com erro.`,
        );
      }
    }

    return { imported, errors };
  },

  deleteBibleVersion: async (versionId: string) => {
    try {
      await deleteBible(versionId);
      toast.info("Versão bíblica removida.");
      const versions = await listBibleVersions();
      set({ versions });
      if (get().activeVersionId === versionId) {
        if (versions.length > 0) {
          await get().setActiveVersion(versions[0].id);
        } else {
          set({
            activeVersionId: "",
            books: [],
            verses: [],
            selectedVerseNum: null,
          });
        }
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao excluir versão: ${msg}`);
      return false;
    }
  },

  setTestamentFilter: (testamentFilter) => set({ testamentFilter }),
  setBookFilter: (bookFilter) => set({ bookFilter }),

  selectBook: async (bookId: number) => {
    const { activeVersionId } = get();
    if (!activeVersionId) return;

    try {
      set({ activeBookId: bookId, activeChapter: 1, selectedVerseNum: null, loading: true });
      const verses = await getBibleChapter(activeVersionId, bookId, 1);
      set({ verses });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectChapter: async (chapter: number) => {
    const { activeVersionId, activeBookId } = get();
    if (!activeVersionId) return;

    try {
      set({ activeChapter: chapter, selectedVerseNum: null, loading: true });
      const verses = await getBibleChapter(activeVersionId, activeBookId, chapter);
      set({ verses });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectVerse: (verseNum: number, partIndex = 0) => {
    const { books, activeBookId, activeChapter, activeVersionId, verses, getVerseParts } = get();
    const verse = verses.find((v) => v.verse === verseNum);
    if (verse) {
      const parts = getVerseParts(verse.text);
      const safePart = Math.max(0, Math.min(partIndex, parts.length - 1));
      const book = books.find((b) => b.id === activeBookId);
      const bookName = book?.name ?? `Livro ${activeBookId}`;
      const slide = buildScriptureSlide({
        versionId: activeVersionId,
        bookId: activeBookId,
        bookName,
        chapter: activeChapter,
        verse: verse.verse,
        text: parts[safePart],
        part: safePart,
        totalParts: parts.length,
      });
      set({ selectedVerseNum: verseNum, activePartIndex: safePart });
      usePresentationStore.getState().setPreview(slide);
    }
  },

  presentCurrentVerse: async (partIndex?: number) => {
    const { verses, selectedVerseNum, activePartIndex } = get();
    if (!selectedVerseNum) return;
    const verse = verses.find((v) => v.verse === selectedVerseNum);
    if (verse) {
      await get().presentVerse(verse, undefined, partIndex ?? activePartIndex);
    }
  },

  presentVerse: async (
    verse: BibleVerse,
    versionOverride?: string,
    partIndex?: number,
  ) => {
    const { books, activeBookId, activeChapter, activeVersionId, verses, getVerseParts } = get();
    const version = versionOverride || activeVersionId;
    const book = books.find((b) => b.id === activeBookId);
    const bookName = book?.name ?? `Livro ${activeBookId}`;

    const parts = getVerseParts(verse.text);
    const curPart = Math.max(0, Math.min(partIndex ?? 0, parts.length - 1));

    const slideFor = (target: BibleVerse, targetPart: number, targetParts: string[]) =>
      buildScriptureSlide({
        versionId: version,
        bookId: activeBookId,
        bookName,
        chapter: activeChapter,
        verse: target.verse,
        text: targetParts[targetPart],
        part: targetPart,
        totalParts: targetParts.length,
      });

    const slide = slideFor(verse, curPart, parts);

    // Acha versículo seguinte e anterior no mesmo capítulo
    const nextV = verses.find((v) => v.verse === verse.verse + 1);
    const prevV = verses.find((v) => v.verse === verse.verse - 1);

    let nextSlide: SlideContent | null = null;
    if (curPart < parts.length - 1) {
      nextSlide = slideFor(verse, curPart + 1, parts);
    } else if (nextV) {
      const nextParts = getVerseParts(nextV.text);
      nextSlide = slideFor(nextV, 0, nextParts);
    }

    let prevSlide: SlideContent | null = null;
    if (curPart > 0) {
      prevSlide = slideFor(verse, curPart - 1, parts);
    } else if (prevV) {
      const prevParts = getVerseParts(prevV.text);
      prevSlide = slideFor(prevV, prevParts.length - 1, prevParts);
    }

    set({
      selectedVerseNum: verse.verse,
      activePartIndex: curPart,
      liveVerseKey: slide.id,
    });

    await usePresentationStore.getState().publishLive(slide, nextSlide, prevSlide);
  },

  presentReference: async (ref, partIndex) => {
    const { versions } = get();
    const versionId = ref.versionId;
    if (!versionId) return;
    try {
      const available = versions.length > 0 ? versions : await listBibleVersions();
      if (versions.length === 0) set({ versions: available });
      if (!available.some((version) => version.id === versionId)) {
        toast.error(`Versão "${versionId}" não está instalada.`);
        return;
      }
      if (get().activeVersionId !== versionId) {
        const books = await getBibleBooks(versionId);
        set({ activeVersionId: versionId, books });
      }
      const verses = await getBibleChapter(versionId, ref.bookId, ref.chapter);
      set({
        activeBookId: ref.bookId,
        activeChapter: ref.chapter,
        verses,
        selectedVerseNum: ref.verse,
        activePartIndex: Math.max(0, partIndex ?? ref.part),
        isSearching: false,
      });
      const verse = verses.find((candidate) => candidate.verse === ref.verse);
      if (!verse) {
        toast.error(`Versículo ${ref.bookName} ${ref.chapter}:${ref.verse} não encontrado.`);
        return;
      }
      await get().presentVerse(verse, versionId, partIndex ?? ref.part);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  },

  syncLiveScripture: async (ref) => {
    if (!ref.versionId) return;
    try {
      let books = get().books;
      const versionChanged = get().activeVersionId !== ref.versionId;
      if (versionChanged) {
        books = await getBibleBooks(ref.versionId);
        if (!books.some((book) => book.id === ref.bookId)) return;
        set({ activeVersionId: ref.versionId, books });
      }
      if (!books.some((book) => book.id === ref.bookId)) return;
      const chapterChanged =
        versionChanged ||
        get().activeBookId !== ref.bookId ||
        get().activeChapter !== ref.chapter ||
        get().verses.length === 0;
      if (chapterChanged) {
        const verses = await getBibleChapter(ref.versionId, ref.bookId, ref.chapter);
        set({ activeBookId: ref.bookId, activeChapter: ref.chapter, verses });
      }
      set({
        activeBookId: ref.bookId,
        activeChapter: ref.chapter,
        selectedVerseNum: ref.verse,
        activePartIndex: ref.part,
        liveVerseKey: scriptureSlideId(ref, ref.part, ref.totalParts),
        isSearching: false,
      });
    } catch {
      // Mantém a seleção atual quando a versão/livro não está mais disponível.
    }
  },

  presentNextVerse: async () => {
    const { verses, selectedVerseNum, activePartIndex, getVerseParts } = get();
    if (!selectedVerseNum) return;
    const currentVerse = verses.find((v) => v.verse === selectedVerseNum);
    if (!currentVerse) return;

    const parts = getVerseParts(currentVerse.text);
    if (activePartIndex < parts.length - 1) {
      await get().presentVerse(currentVerse, undefined, activePartIndex + 1);
      return;
    }

    const nextV = verses.find((v) => v.verse === selectedVerseNum + 1);
    if (nextV) {
      await get().presentVerse(nextV, undefined, 0);
    }
  },

  presentPrevVerse: async () => {
    const { verses, selectedVerseNum, activePartIndex, getVerseParts } = get();
    if (!selectedVerseNum) return;
    const currentVerse = verses.find((v) => v.verse === selectedVerseNum);
    if (!currentVerse) return;

    if (activePartIndex > 0) {
      await get().presentVerse(currentVerse, undefined, activePartIndex - 1);
      return;
    }

    const prevV = verses.find((v) => v.verse === selectedVerseNum - 1);
    if (prevV) {
      const prevParts = getVerseParts(prevV.text);
      await get().presentVerse(prevV, undefined, prevParts.length - 1);
    }
  },

  searchWords: async (query: string) => {
    const { activeVersionId } = get();
    const clean = query.trim();
    if (!clean || !activeVersionId) {
      set({ searchQuery: "", searchResults: [], isSearching: false });
      return;
    }

    try {
      set({ searchQuery: clean, isSearching: true, loading: true });
      const results = await searchBibleVerses(activeVersionId, clean, 100);
      set({ searchResults: results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao pesquisar versículos: ${msg}`);
      set({ searchResults: [] });
    } finally {
      set({ loading: false });
    }
  },

  clearSearch: () => {
    set({ searchQuery: "", searchResults: [], isSearching: false });
  },

  openCompare: async (verseNum: number) => {
    const { activeBookId, activeChapter, versions, books } = get();
    const versionIds = versions.map((v) => v.id);
    const book = books.find((b) => b.id === activeBookId);
    const bookName = book?.name ?? `Livro ${activeBookId}`;

    try {
      set({
        isComparing: true,
        compareTarget: {
          bookId: activeBookId,
          chapter: activeChapter,
          verse: verseNum,
          bookName,
        },
        loading: true,
      });

      const results = await compareBibleVerse(
        activeBookId,
        activeChapter,
        verseNum,
        versionIds,
      );
      set({ compareResults: results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao comparar versões: ${msg}`);
    } finally {
      set({ loading: false });
    }
  },

  closeCompare: () => {
    set({ isComparing: false, compareTarget: null, compareResults: [] });
  },

  presentFromCompare: async (compare: BibleVerseCompare) => {
    if (!compare.verse) return;
    await get().presentVerse(compare.verse, compare.versionId);
  },

  goToVerse: async (bookId: number, chapter: number, verseNum = 1, autoPresent = false) => {
    const { activeVersionId } = get();
    if (!activeVersionId) return;

    try {
      set({
        activeBookId: bookId,
        activeChapter: chapter,
        selectedVerseNum: verseNum,
        isSearching: false,
        loading: true,
      });

      const verses = await getBibleChapter(activeVersionId, bookId, chapter);
      set({ verses });

      get().selectVerse(verseNum);

      if (autoPresent) {
        const verseObj = verses.find((v) => v.verse === verseNum);
        if (verseObj) {
          await get().presentVerse(verseObj);
        }
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  jumpToReference: async (rawRef: string) => {
    const parsed = parseBibleReference(rawRef);
    if (!parsed) {
      toast.error(`Referência inválida: "${rawRef}". Exemplo: João 3:16`);
      return false;
    }

    const { activeVersionId, books } = get();
    if (!activeVersionId) return false;

    const book = books.find((b) => b.id === parsed.bookId);
    if (!book) {
      toast.error(`Livro "${parsed.bookName}" não encontrado na versão atual.`);
      return false;
    }

    if (parsed.chapter > book.chapterCount || parsed.chapter < 1) {
      toast.error(
        `${book.name} possui apenas ${book.chapterCount} capítulo(s).`,
      );
      return false;
    }

    try {
      await get().goToVerse(parsed.bookId, parsed.chapter, parsed.verse ?? 1, false);
      toast.success(
        `Navegado para ${book.name} ${parsed.chapter}${parsed.verse ? `:${parsed.verse}` : ""}`,
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao navegar para versículo: ${msg}`);
      return false;
    }
  },
}));
