import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  closeSongEditor,
  deleteSong as deleteSongIpc,
  getSong,
  lyricsToText,
  parseLyrics,
  saveSong as saveSongIpc,
} from "@/core/ipc/commands";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import { buildSongSlides, type RunnerSlide } from "@/core/lib/lyrics";
import { useSongDefaultsStore } from "@/core/store/songDefaultsStore";
import type { SectionType, Song, SongSection } from "@/core/types";
import { SongLyricsEditor } from "@/features/songs/SongLyricsEditor";
import {
  SongMetadataHeader,
  type EditorSongDraft,
} from "@/features/songs/SongMetadataHeader";
import { SongSlidesPreview } from "@/features/songs/SongSlidesPreview";
import { assignSectionLabel } from "@/features/songs/songEditorUtils";

const PREVIEW_DEBOUNCE_MS = 250;

function createEmptyDraft(): EditorSongDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    artist: "",
    album: "",
    composer: "",
    songKey: "",
    bpm: undefined,
  };
}

function previewSlides(
  sections: SongSection[],
  draft: EditorSongDraft,
  addEmptySlideAtStart: boolean,
): RunnerSlide[] {
  return buildSongSlides(
    {
      id: draft.id,
      title: draft.title,
      artist: draft.artist,
      album: draft.album,
      composer: draft.composer,
      songKey: draft.songKey,
      bpm: draft.bpm,
      sections,
    },
    { addEmptySlideAtStart },
  );
}

function hasContent(sections: SongSection[]): boolean {
  return sections.some((section) =>
    section.lines.some((line) => line.trim() !== ""),
  );
}

export default function SongEditorView() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get("id");

  const [currentId, setCurrentId] = useState<string | null>(initialId);
  const [draft, setDraft] = useState<EditorSongDraft>(createEmptyDraft);
  const [isNew, setIsNew] = useState(true);
  const [text, setText] = useState("");
  const [textReady, setTextReady] = useState(false);
  const [preview, setPreview] = useState<RunnerSlide[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const addEmptySlideAtStart = useSongDefaultsStore(
    (s) => s.addEmptySlideAtStart,
  );

  // Carrega os dados da música a partir do ID
  const loadSongById = useCallback(async (id: string | null) => {
    setConfirmDelete(false);
    setActionError(null);
    setTextReady(false);
    setText("");

    if (!id || id.trim() === "") {
      const newDraft = createEmptyDraft();
      setDraft(newDraft);
      setIsNew(true);
      setText("");
      setPreview([]);
      setTextReady(true);
      return;
    }

    try {
      const song = await getSong(id);
      if (!song) {
        setActionError("Música não encontrada.");
        return;
      }

      const loadedDraft: EditorSongDraft = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album ?? "",
        composer: song.composer ?? "",
        songKey: song.songKey ?? "",
        bpm: song.bpm,
      };

      setDraft(loadedDraft);
      setIsNew(false);
      setPreview(
        hasContent(song.sections)
          ? previewSlides(
              song.sections,
              loadedDraft,
              useSongDefaultsStore.getState().addEmptySlideAtStart,
            )
          : [],
      );

      const lyrics = await lyricsToText(song.sections);
      setText(lyrics);
      setTextReady(true);
    } catch {
      setActionError("Não foi possível carregar os dados da música.");
    }
  }, []);

  useEffect(() => {
    void loadSongById(currentId);
  }, [currentId, loadSongById]);

  // Escuta evento emitido caso a janela do Tauri já esteja aberta e receba nova música
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listenCommand<string | null>("song-editor://open", (payload) => {
      setCurrentId(payload && payload.trim() !== "" ? payload : null);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // Atualiza prévia dos slides com debounce
  useEffect(() => {
    if (!textReady) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      parseLyrics(text)
        .then((sections) => {
          if (!cancelled) {
            setPreview(previewSlides(sections, draft, addEmptySlideAtStart));
          }
        })
        .catch(() => {});
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, text, textReady, addEmptySlideAtStart]);

  const updateDraft = useCallback((patch: Partial<EditorSongDraft>) => {
    setDraft((curr) => ({ ...curr, ...patch }));
  }, []);

  const handleClose = useCallback(async () => {
    if (isTauri()) {
      try {
        await closeSongEditor();
        return;
      } catch {
        window.close();
      }
    } else {
      window.close();
      if (window.history.length > 1) {
        window.history.back();
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (draft.title.trim() === "" || isSaving) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const sections = await parseLyrics(text);
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

      await saveSongIpc(songPayload);
      toast.success(`Música "${songPayload.title}" salva com sucesso!`);
      await handleClose();
    } catch {
      setActionError("Não foi possível salvar a música.");
    } finally {
      setIsSaving(false);
    }
  }, [draft, text, isSaving, handleClose]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActionError(null);
    try {
      await deleteSongIpc(draft.id);
      toast.success("Música excluída com sucesso.");
      await handleClose();
    } catch {
      setActionError("Não foi possível excluir a música.");
    }
  }, [draft.id, confirmDelete, handleClose]);

  const handleSetSectionLabel = useCallback((sectionIndex: number, newType: SectionType | null) => {
    setText((currText) => assignSectionLabel(currText, sectionIndex, newType));
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (draft.title.trim() !== "" && textReady) {
          void handleSave();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        void handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draft.title, textReady, handleSave, handleClose]);

  const canSave = draft.title.trim() !== "" && textReady && !isSaving;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* Header com Metadados da Música e Botões de Ação */}
      <SongMetadataHeader
        draft={draft}
        isNew={isNew}
        canSave={canSave}
        confirmDelete={confirmDelete}
        onUpdateDraft={updateDraft}
        onSave={handleSave}
        onCancel={handleClose}
        onDelete={handleDelete}
      />

      {/* Banner de Erro */}
      {actionError !== null && (
        <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-xs text-destructive">
          <span>{actionError}</span>
          {!textReady && (
            <button
              type="button"
              className="underline hover:no-underline font-medium ml-2"
              onClick={() => void loadSongById(currentId)}
            >
              Tentar carregar novamente
            </button>
          )}
        </div>
      )}

      {/* Estrutura de 2 Colunas: Coluna 1 (Letra) | Coluna 2 (Slides / Prévia) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border/60 p-4 gap-4 bg-muted/10">
        {/* Coluna 1: Letra com Realce de Sintaxe */}
        <div className="lg:col-span-6 flex flex-col min-h-0 h-full">
          <SongLyricsEditor
            value={text}
            onChange={setText}
            disabled={!textReady}
            slidesCount={preview.length}
          />
        </div>

        {/* Coluna 2: A música separada nos slides */}
        <div className="lg:col-span-6 flex flex-col min-h-0 h-full">
          <SongSlidesPreview
            slides={preview}
            songTitle={draft.title}
            songArtist={draft.artist}
            onSetLabel={handleSetSectionLabel}
          />
        </div>
      </div>
    </div>
  );
}
