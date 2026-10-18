import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { lyricsToText, parseLyrics } from "@/core/ipc/commands";
import { buildSongSlides, type RunnerSlide } from "@/core/lib/lyrics";
import type { SectionType, Song, SongSection } from "@/core/types";
import { SongLyricsEditor } from "./SongLyricsEditor";
import {
  SongMetadataHeader,
  type EditorSongDraft,
} from "./SongMetadataHeader";
import { SongSlidesPreview } from "./SongSlidesPreview";
import { assignSectionLabel } from "./songEditorUtils";
import { useSongsStore } from "./store";

const PREVIEW_DEBOUNCE_MS = 250;

function previewSlides(sections: SongSection[], draft: EditorSongDraft): RunnerSlide[] {
  return buildSongSlides({
    id: draft.id,
    title: draft.title,
    artist: draft.artist,
    album: draft.album,
    composer: draft.composer,
    songKey: draft.songKey,
    bpm: draft.bpm,
    sections,
  });
}

function hasContent(sections: SongSection[]): boolean {
  return sections.some((section) =>
    section.lines.some((line) => line.trim() !== ""),
  );
}

export function SongEditorDialog() {
  const editorSong = useSongsStore((s) => s.editorSong);
  const closeEditor = useSongsStore((s) => s.closeEditor);
  const saveEditor = useSongsStore((s) => s.saveEditor);
  const deleteSong = useSongsStore((s) => s.deleteSong);

  const [draft, setDraft] = useState<EditorSongDraft | null>(null);
  const [text, setText] = useState("");
  const [textReady, setTextReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<RunnerSlide[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Carrega os dados da música quando editorSong é aberto
  useEffect(() => {
    setConfirmDelete(false);
    setActionError(null);
    setTextReady(false);
    setText("");

    if (editorSong === null) {
      setDraft(null);
      setPreview([]);
      return;
    }

    const currentDraft: EditorSongDraft = {
      id: editorSong.id,
      title: editorSong.title,
      artist: editorSong.artist,
      album: editorSong.album,
      composer: editorSong.composer,
      songKey: editorSong.songKey,
      bpm: editorSong.bpm,
    };

    setDraft(currentDraft);
    setPreview(
      hasContent(editorSong.sections)
        ? previewSlides(editorSong.sections, currentDraft)
        : [],
    );

    let cancelled = false;
    lyricsToText(editorSong.sections)
      .then((lyrics) => {
        if (cancelled) return;
        setText(lyrics);
        setTextReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setActionError("Não foi possível carregar a letra da música.");
      });

    return () => {
      cancelled = true;
    };
  }, [editorSong, reloadKey]);

  // Atualiza a prévia dos slides com debounce sempre que o texto ou o título/artista mudam
  useEffect(() => {
    if (draft === null || !textReady) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      parseLyrics(text)
        .then((sections) => {
          if (!cancelled) {
            setPreview(previewSlides(sections, draft));
          }
        })
        .catch(() => {});
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, text, textReady]);

  const updateDraft = useCallback((patch: Partial<EditorSongDraft>) => {
    setDraft((curr) => (curr === null ? curr : { ...curr, ...patch }));
  }, []);

  const handleSave = useCallback(async () => {
    if (draft === null || draft.title.trim() === "") return;
    setActionError(null);
    let sections: SongSection[];
    try {
      sections = await parseLyrics(text);
    } catch {
      setActionError("Não foi possível interpretar a letra.");
      return;
    }

    const songPayload: Song = {
      id: draft.id,
      title: draft.title.trim(),
      artist: draft.artist.trim(),
      album: draft.album?.trim() ? draft.album.trim() : undefined,
      composer: draft.composer?.trim() ? draft.composer.trim() : undefined,
      songKey: draft.songKey?.trim() ? draft.songKey.trim() : undefined,
      bpm: draft.bpm,
      sections,
    };

    const ok = await saveEditor(songPayload);
    if (!ok) {
      setActionError(
        useSongsStore.getState().error ?? "Não foi possível salvar a música.",
      );
    }
  }, [draft, text, saveEditor]);

  const handleDelete = useCallback(async () => {
    if (draft === null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActionError(null);
    const ok = await deleteSong(draft.id);
    if (!ok) {
      setActionError(
        useSongsStore.getState().error ?? "Não foi possível excluir a música.",
      );
    }
  }, [draft, confirmDelete, deleteSong]);

  // Atribuição de rótulo via botão direito no slide da Coluna 2
  const handleSetSlideLabel = useCallback(
    (slideIndex: number, newType: SectionType | null) => {
      setText((currText) => {
        const updated = assignSectionLabel(currText, slideIndex, newType);
        return updated;
      });
    },
    [],
  );

  // Atalho global Cmd+S / Ctrl+S para salvar
  useEffect(() => {
    if (!draft) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (draft.title.trim() !== "" && textReady) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draft, textReady, handleSave]);

  if (editorSong === null || draft === null) {
    return null;
  }

  const isNew = editorSong.title === "" && editorSong.artist === "";
  const canSave = draft.title.trim() !== "" && textReady;

  return (
    <Dialog
      open={editorSong !== null}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="w-[88vw] sm:max-w-[82vw] md:max-w-[80vw] lg:max-w-[78vw] h-[84vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border/80 shadow-2xl bg-background text-foreground"
      >
        {/* Header com Metadados da Música */}
        <SongMetadataHeader
          draft={draft}
          isNew={isNew}
          canSave={canSave}
          confirmDelete={confirmDelete}
          onUpdateDraft={updateDraft}
          onSave={handleSave}
          onCancel={closeEditor}
          onDelete={handleDelete}
        />

        {/* Mensagem de Erro de Ação */}
        {actionError !== null && (
          <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-xs text-destructive">
            <span>{actionError}</span>
            {!textReady && (
              <button
                type="button"
                className="underline hover:no-underline font-medium ml-2"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Tentar carregar novamente
              </button>
            )}
          </div>
        )}

        {/* Estrutura de 2 Colunas: Coluna 1 (Letra) | Coluna 2 (Slides / Prévia) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border/60 p-4 gap-4 bg-muted/10">
          {/* Coluna 1: Letra com Realce de Sintaxe (// comentários, ## seções, [cifras]) */}
          <div className="lg:col-span-6 flex flex-col min-h-0 h-full">
            <SongLyricsEditor
              value={text}
              onChange={setText}
              disabled={!textReady}
              slidesCount={preview.length}
            />
          </div>

          {/* Coluna 2: A música separada nos slides (Grade, Tema Público e Menu de Contexto) */}
          <div className="lg:col-span-6 flex flex-col min-h-0 h-full">
            <SongSlidesPreview
              slides={preview}
              songTitle={draft.title}
              songArtist={draft.artist}
              onSetLabel={handleSetSlideLabel}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
