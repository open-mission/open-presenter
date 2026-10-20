import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildScriptureRef } from "@/core/lib/biblePresentation";
import { useBibleStore } from "@/features/bible/store";
import { useSetlistStore } from "./store";

interface BibleVersePickerDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  partId?: string;
  initialVerse?: {
    versionId: string;
    bookId: number;
    chapter: number;
    verse: number;
  } | null;
}

export function BibleVersePickerDialog({
  open,
  onOpenChange,
  partId,
  initialVerse,
}: BibleVersePickerDialogProps) {
  const versions = useBibleStore((s) => s.versions);
  const activeVersionId = useBibleStore((s) => s.activeVersionId);
  const books = useBibleStore((s) => s.books);
  const activeBookId = useBibleStore((s) => s.activeBookId);
  const activeChapter = useBibleStore((s) => s.activeChapter);
  const verses = useBibleStore((s) => s.verses);
  const loading = useBibleStore((s) => s.loading);
  const loadInitial = useBibleStore((s) => s.loadInitial);
  const setActiveVersion = useBibleStore((s) => s.setActiveVersion);
  const selectBook = useBibleStore((s) => s.selectBook);
  const selectChapter = useBibleStore((s) => s.selectChapter);

  const event = useSetlistStore((s) => s.event);
  const addPart = useSetlistStore((s) => s.addPart);
  const addScripture = useSetlistStore((s) => s.addScripture);
  const save = useSetlistStore((s) => s.save);

  const [selectedVerseNum, setSelectedVerseNum] = useState<number | null>(null);
  const [targetPartId, setTargetPartId] = useState(partId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadInitial();
    setTargetPartId(
      partId && event?.parts.some((part) => part.id === partId)
        ? partId
        : (event?.parts[0]?.id ?? ""),
    );
    // Inicializa apenas ao abrir; mudanças posteriores no evento não devem
    // sobrescrever a seção escolhida pelo usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, partId, loadInitial]);

  useEffect(() => {
    if (!open || !initialVerse) return;
    if (initialVerse.versionId) {
      void useBibleStore
        .getState()
        .goToVerse(
          initialVerse.bookId,
          initialVerse.chapter,
          initialVerse.verse,
          false,
        );
    }
  }, [open, initialVerse]);

  useEffect(() => {
    if (!open) return;
    setSelectedVerseNum((current) => {
      if (current !== null && verses.some((verse) => verse.verse === current)) {
        return current;
      }
      if (
        initialVerse &&
        initialVerse.chapter === activeChapter &&
        initialVerse.bookId === activeBookId
      ) {
        return initialVerse.verse;
      }
      return verses[0]?.verse ?? null;
    });
  }, [open, verses, activeChapter, activeBookId, initialVerse]);

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId),
    [books, activeBookId],
  );
  const selectedVerse = verses.find(
    (verse) => verse.verse === selectedVerseNum,
  );

  async function handleAdd() {
    if (!selectedVerse || !activeBook) return;
    let targetPart = targetPartId;
    if (!targetPart || !event?.parts.some((part) => part.id === targetPart)) {
      targetPart = addPart("");
    }
    const ref = buildScriptureRef({
      versionId: activeVersionId,
      bookId: activeBook.id,
      bookName: activeBook.name,
      chapter: activeChapter,
      verse: selectedVerse.verse,
    });
    setSaving(true);
    try {
      addScripture(targetPart, ref);
      await save();
      toast.success(
        `${activeBook.name} ${activeChapter}:${selectedVerse.verse} adicionado à programação.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-emerald-500" />
            Adicionar Versículo à Programação
          </DialogTitle>
          <DialogDescription>
            Escolha a referência e a seção onde o versículo será inserido.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Versão</span>
            <Select
              value={activeVersionId}
              onValueChange={(value) => void setActiveVersion(value)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Versão" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Livro</span>
            <Select
              value={String(activeBookId)}
              onValueChange={(value) => void selectBook(Number(value))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Livro" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {books.map((book) => (
                  <SelectItem key={book.id} value={String(book.id)}>
                    {book.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Capítulo</span>
            <Select
              value={String(activeChapter)}
              onValueChange={(value) => void selectChapter(Number(value))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Capítulo" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {activeBook &&
                  Array.from(
                    { length: activeBook.chapterCount },
                    (_, index) => index + 1,
                  ).map((chapter) => (
                    <SelectItem key={chapter} value={String(chapter)}>
                      Capítulo {chapter}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Versículo
          </span>
          <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-border/60 p-2 sm:grid-cols-3">
            {loading && verses.length === 0 ? (
              <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                Carregando versículos…
              </p>
            ) : verses.length === 0 ? (
              <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                Nenhum versículo disponível. Importe uma Bíblia primeiro.
              </p>
            ) : (
              verses.map((verse) => (
                <button
                  key={verse.id || verse.verse}
                  type="button"
                  onClick={() => setSelectedVerseNum(verse.verse)}
                  className={`rounded-md border p-2 text-left text-xs transition-colors cursor-pointer ${
                    selectedVerseNum === verse.verse
                      ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {activeBook?.abbrev ?? activeBook?.name} {activeChapter}:
                    {verse.verse}
                  </span>
                  <span className="mt-1 line-clamp-2 block leading-relaxed">
                    {verse.text}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Seção</span>
          <Select value={targetPartId} onValueChange={setTargetPartId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione a seção" />
            </SelectTrigger>
            <SelectContent>
              {event?.parts.map((part) => (
                <SelectItem key={part.id} value={part.id}>
                  {part.title || "Seção sem título"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!selectedVerse || saving}
          >
            <Plus className="size-3.5 mr-1.5" />
            Adicionar à Programação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
