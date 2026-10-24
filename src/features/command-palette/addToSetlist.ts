import { toast } from "sonner";
import type { BackgroundAsset } from "@/features/media-library/types";
import type { MediaItem, ScriptureRef, SongSummary } from "@/core/types";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useBibleStore } from "@/features/bible/store";
import { resolveApplyTarget, applyBackgroundToOutput } from "@/features/media-library/applyAsset";

export function addItemToActiveSetlist(params: {
  song?: SongSummary;
  media?: MediaItem;
  scripture?: ScriptureRef;
}) {
  const store = useSetlistStore.getState();
  const event = store.event;

  let partId = event?.parts[0]?.id;
  if (!event || event.parts.length === 0) {
    partId = store.addPart(params.song ? "Louvor" : params.scripture ? "Palavra" : "Mídia");
  }

  if (!partId) return;

  if (params.song) {
    store.addSong(partId, params.song);
    toast.success(`"${params.song.title}" adicionada à programação!`);
  } else if (params.media) {
    store.addMedia(partId, params.media);
    toast.success(`"${params.media.title}" adicionada à programação!`);
  } else if (params.scripture) {
    store.addScripture(partId, params.scripture);
    toast.success(
      `"${params.scripture.bookName} ${params.scripture.chapter}:${params.scripture.verse}" adicionado à programação!`,
    );
  }

  void store.save();
}

export async function presentSongImmediately(songId: string) {
  const store = useSetlistStore.getState();
  await store.appendImprevistoSong(songId);
  toast.success("Música colocada ao vivo!");
}

export async function presentBibleVerseImmediately(
  bookId: number,
  chapter: number,
  verse: number,
  versionId?: string,
) {
  const bibleStore = useBibleStore.getState();
  if (versionId && versionId !== bibleStore.activeVersionId) {
    await bibleStore.setActiveVersion(versionId);
  }
  await bibleStore.goToVerse(bookId, chapter, verse, true);
  toast.success("Versículo bíblico projetado ao vivo!");
}

export function applyMediaImmediately(asset: BackgroundAsset) {
  const targetOutput = resolveApplyTarget("public");
  if (!targetOutput) {
    toast.error("Nenhuma tela de saída configurada para aplicar mídia.");
    return;
  }
  applyBackgroundToOutput(targetOutput, asset);
  toast.success(`Fundo "${asset.name}" projetado em ${targetOutput.name}!`);
}
