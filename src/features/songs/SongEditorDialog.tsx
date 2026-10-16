import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lyricsToText, parseLyrics } from "@/core/ipc/commands";
import { buildSongSlides, type RunnerSlide } from "@/core/lib/lyrics";
import type { Song, SongSection } from "@/core/types";
import { useSongsStore } from "./store";

const PREVIEW_DEBOUNCE_MS = 300;

function previewSlides(sections: SongSection[]): RunnerSlide[] {
  return buildSongSlides({ id: "preview", title: "", artist: "", sections });
}

export function SongEditorDialog() {
  const editorSong = useSongsStore((s) => s.editorSong);
  const closeEditor = useSongsStore((s) => s.closeEditor);
  const saveEditor = useSongsStore((s) => s.saveEditor);
  const deleteSong = useSongsStore((s) => s.deleteSong);

  const [draft, setDraft] = useState<Song | null>(editorSong);
  const [text, setText] = useState("");
  const [textReady, setTextReady] = useState(false);
  const [preview, setPreview] = useState<RunnerSlide[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(editorSong);
    setConfirmDelete(false);
    setActionError(null);
    setTextReady(false);
    setPreview(editorSong === null ? [] : previewSlides(editorSong.sections));
    if (editorSong === null) return;

    let cancelled = false;
    lyricsToText(editorSong.sections)
      .then((lyrics) => {
        if (cancelled) return;
        setText(lyrics);
        setTextReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setText("");
        setActionError("Não foi possível carregar a letra da música.");
      });

    return () => {
      cancelled = true;
    };
  }, [editorSong]);

  useEffect(() => {
    if (draft === null || !textReady) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      parseLyrics(text)
        .then((sections) => {
          if (!cancelled) setPreview(previewSlides(sections));
        })
        .catch(() => {});
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, text, textReady]);

  const updateDraft = (patch: Partial<Song>) =>
    setDraft((current) => (current === null ? current : { ...current, ...patch }));

  const handleSave = async () => {
    if (draft === null || draft.title.trim() === "") return;
    setActionError(null);
    let sections: SongSection[];
    try {
      sections = await parseLyrics(text);
    } catch {
      setActionError("Não foi possível interpretar a letra.");
      return;
    }
    const ok = await saveEditor({
      id: draft.id,
      title: draft.title.trim(),
      artist: draft.artist.trim(),
      sections,
    });
    if (!ok) {
      setActionError(
        useSongsStore.getState().error ?? "Não foi possível salvar.",
      );
    }
  };

  const handleDelete = async () => {
    if (draft === null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActionError(null);
    const ok = await deleteSong(draft.id);
    if (!ok) {
      setActionError(
        useSongsStore.getState().error ?? "Não foi possível excluir.",
      );
    }
  };

  return (
    <Dialog
      open={editorSong !== null}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      {draft && (
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {draft.title !== "" ? "Editar música" : "Nova música"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Título</span>
              <Input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Artista</span>
              <Input
                value={draft.artist}
                onChange={(e) => updateDraft({ artist: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Letra</span>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Uma linha por verso…\n\n##(Refrão)\n\nDeixe uma linha em branco entre os blocos"}
              className="min-h-56"
              disabled={!textReady}
            />
            <p className="text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                ##(Nome)
              </code>{" "}
              nomeia o bloco (ex.: Refrão, Verso 2) e uma linha em branco
              separa os slides. Linhas iniciadas por{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">//</code>{" "}
              não aparecem no telão.
            </p>
          </div>
          {preview.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">
                Slides ({preview.length})
              </span>
              <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
                {preview.map((item) => (
                  <div
                    key={item.index}
                    className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1"
                  >
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {item.index + 1}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {item.label ?? "Sem rótulo"}
                    </Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.slide.lines.slice(0, 2).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {actionError !== null && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              className="sm:mr-auto"
              onClick={handleDelete}
            >
              {confirmDelete ? "Confirmar?" : "Excluir"}
            </Button>
            <Button variant="outline" onClick={closeEditor}>
              Cancelar
            </Button>
            <Button
              disabled={draft.title.trim() === "" || !textReady}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
