import { getSong } from "@/core/ipc/commands";
import { buildSongSlides } from "@/core/lib/lyrics";
import { buildMediaSlides, mediaKindLabel } from "@/core/lib/media";
import type {
  EventItem,
  RemoteItem,
  RemoteSetlist,
  RemoteSlide,
  ServiceEvent,
  Song,
} from "@/core/types";

async function buildRemoteItem(
  item: EventItem,
  cache: Record<string, Song>,
): Promise<RemoteItem> {
  if (item.media) {
    const slides: RemoteSlide[] = buildMediaSlides(item.id, item.media).map(
      (entry) => ({
        index: entry.index,
        label: entry.label,
        content: entry.slide,
      }),
    );

    return {
      id: item.id,
      kind: "media",
      title: item.media.title,
      subtitle: mediaKindLabel(item.media.kind),
      nextItemId: item.nextItemId,
      slides,
    };
  }

  if (item.songId) {
    const song = cache[item.songId] ?? (await getSong(item.songId));
    if (song) {
      const slides: RemoteSlide[] = buildSongSlides(song).map((entry) => ({
        index: entry.index,
        label: entry.label,
        content: entry.slide,
      }));

      return {
        id: item.id,
        kind: "song",
        title: song.title,
        subtitle: song.artist || null,
        nextItemId: item.nextItemId,
        slides,
      };
    }
  }

  return {
    id: item.id,
    kind: item.songId ? "song" : "media",
    title: item.song?.title ?? "Item removido",
    subtitle: null,
    nextItemId: item.nextItemId,
    slides: [],
  };
}

export async function buildRemoteSetlist(
  event: ServiceEvent,
  cache: Record<string, Song> = {},
): Promise<RemoteSetlist> {
  const parts = await Promise.all(
    event.parts.map(async (part) => ({
      id: part.id,
      title: part.title || "Programação",
      items: await Promise.all(
        part.items.map((item) => buildRemoteItem(item, cache)),
      ),
    })),
  );

  return {
    eventId: event.id,
    title: event.title,
    eventDate: event.eventDate,
    parts,
  };
}
