import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buildMediaSlides } from "@/core/lib/media";
import type { MediaItem } from "@/core/types";
import { SongLyricsEditor } from "@/features/songs/SongLyricsEditor";
import {
  SongMetadataHeader,
  type EditorSongDraft,
} from "@/features/songs/SongMetadataHeader";
import { usePresentationStore } from "@/features/presentation/store";
import { SongSlidesPreview } from "@/features/songs/SongSlidesPreview";
import { findEventItem, useSetlistStore } from "./store";

interface TextEditorDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  partId: string;
  itemId?: string | null;
}

export function TextEditorDialog({
  open,
  onOpenChange,
  partId,
  itemId,
}: TextEditorDialogProps) {
  const addMedia = useSetlistStore((s) => s.addMedia);
  const updateMedia = useSetlistStore((s) => s.updateMedia);
  const removeItem = useSetlistStore((s) => s.removeItem);
  const save = useSetlistStore((s) => s.save);
  const selectItem = useSetlistStore((s) => s.selectItem);

  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewItemId = itemId ?? "text-draft";

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setActionError(null);
    const currentEvent = useSetlistStore.getState().event;
    const item = itemId ? findEventItem(currentEvent, itemId) : undefined;
    if (item?.media) {
      setName(item.media.title);
      setText(item.media.text ?? "");
      setThemeId(item.media.themeId ?? null);
    } else {
      setName("");
      setText("");
      setThemeId(null);
    }
  }, [open, itemId]);

  const draft: EditorSongDraft = {
    id: previewItemId,
    title: name,
    artist: "",
    album: "",
    composer: "",
    songKey: "",
    bpm: undefined,
  };

  const updateDraft = useCallback((patch: Partial<EditorSongDraft>) => {
    if (patch.title !== undefined) setName(patch.title);
  }, []);

  const preview = useMemo(() => {
    const media: MediaItem = {
      kind: "text",
      title: name || "Texto",
      text,
      themeId: themeId || undefined,
    };
    return buildMediaSlides(previewItemId, media);
  }, [name, text, themeId, previewItemId]);

  const canSave = name.trim() !== "" && text.trim() !== "" && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setActionError(null);

    const media: MediaItem = {
      kind: "text",
      title: name.trim(),
      text,
      themeId: themeId || undefined,
    };

    try {
      let nextItemId: string | null = itemId ?? null;
      if (itemId) {
        updateMedia(itemId, media);
      } else {
        nextItemId = addMedia(partId, media);
      }

      await save();
      const state = useSetlistStore.getState();
      if (state.error !== null || state.dirty) {
        setActionError(
          state.error ?? "Não foi possível salvar a sequência de textos.",
        );
        return;
      }

      if (nextItemId) selectItem(nextItemId);
      onOpenChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    itemId,
    partId,
    name,
    text,
    addMedia,
    updateMedia,
    save,
    selectItem,
    onOpenChange,
  ]);

  const handleDelete = useCallback(async () => {
    if (!itemId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setActionError(null);
    try {
      const live = usePresentationStore.getState().live;
      const isThisItemLive = live.content.id.startsWith(`${itemId}#`);
      removeItem(itemId);
      if (isThisItemLive) {
        void usePresentationStore.getState().clearLive();
      }
      await save();
      const state = useSetlistStore.getState();
      if (state.error !== null || state.dirty) {
        setActionError(
          state.error ?? "Não foi possível excluir a sequência de textos.",
        );
        return;
      }
      onOpenChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, [itemId, confirmDelete, removeItem, save, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="w-[88vw] sm:max-w-[82vw] md:max-w-[80vw] lg:max-w-[78vw] h-[84vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border/80 shadow-2xl bg-background text-foreground"
      >
        <SongMetadataHeader
          mode="text"
          draft={draft}
          isNew={itemId === null || itemId === undefined}
          canSave={canSave}
          confirmDelete={confirmDelete}
          onUpdateDraft={updateDraft}
          onSave={() => void handleSave()}
          onCancel={() => onOpenChange(false)}
          onDelete={() => void handleDelete()}
        />

        {actionError !== null && (
          <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-xs text-destructive">
            <span>{actionError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border/60 p-4 gap-4 bg-muted/10">
          <div className="lg:col-span-6 flex flex-col min-h-0 h-full">
            <SongLyricsEditor
              mode="text"
              value={text}
              onChange={setText}
              slidesCount={preview.length}
            />
          </div>

          <div className="lg:col-span-6 flex flex-col min-h-0 h-full">
            <SongSlidesPreview
              slides={preview}
              songTitle={name}
              songArtist=""
              kind="custom"
              asset="text"
              showLabels={false}
              themeGuid={themeId}
              onThemeChange={setThemeId}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
