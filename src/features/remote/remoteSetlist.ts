import { getBibleChapter, getSong } from "@/core/ipc/commands";
import { buildSongSlides } from "@/core/lib/lyrics";
import { buildMediaSlides, mediaKindLabel } from "@/core/lib/media";
import {
  bibleSplitThreshold,
  buildScriptureSlides,
} from "@/core/lib/biblePresentation";
import type {
  EventItem,
  RemoteItem,
  RemoteSetlist,
  RemoteSlide,
  ServiceEvent,
  Song,
  SongGroupConfig,
} from "@/core/types";

async function buildScriptureItem(item: EventItem): Promise<RemoteItem> {
  const ref = item.scripture!;
  const title = `${ref.bookName} ${ref.chapter}:${ref.verse}`;
  try {
    const verses = await getBibleChapter(
      ref.versionId,
      ref.bookId,
      ref.chapter,
    );
    const verse = verses.find((candidate) => candidate.verse === ref.verse);
    const slides: RemoteSlide[] = verse
      ? buildScriptureSlides({
          versionId: ref.versionId,
          bookId: ref.bookId,
          bookName: ref.bookName,
          chapter: ref.chapter,
          verse: ref.verse,
          text: verse.text,
          threshold: bibleSplitThreshold(),
        }).map((slide, index) => ({
          index,
          label:
            (slide.scripture?.totalParts ?? 1) > 1
              ? `Parte ${index + 1}/${slide.scripture?.totalParts}`
              : null,
          content: slide,
        }))
      : [];

    return {
      id: item.id,
      kind: "scripture",
      title,
      subtitle: ref.versionId,
      nextItemId: item.nextItemId,
      slides,
    };
  } catch {
    return {
      id: item.id,
      kind: "scripture",
      title,
      subtitle: ref.versionId,
      nextItemId: item.nextItemId,
      slides: [],
    };
  }
}

async function buildRemoteItem(
  item: EventItem,
  cache: Record<string, Song>,
  addEmptySlideAtStart: boolean,
): Promise<RemoteItem> {
  if (item.scripture) {
    return buildScriptureItem(item);
  }

  if (item.media) {
    const slides: RemoteSlide[] = buildMediaSlides(item.id, item.media).map(
      (entry) => ({
        index: entry.index,
        label: entry.label,
        sectionType: null,
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
      const slides: RemoteSlide[] = buildSongSlides(song, {
        addEmptySlideAtStart,
      }).map((entry) => ({
        index: entry.index,
        label: entry.label,
        sectionType: entry.sectionType,
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
  groups: SongGroupConfig[] = [],
  addEmptySlideAtStart = false,
): Promise<RemoteSetlist> {
  const parts = await Promise.all(
    event.parts.map(async (part) => ({
      id: part.id,
      title: part.title || "Programação",
      items: await Promise.all(
        part.items.map((item) =>
          buildRemoteItem(item, cache, addEmptySlideAtStart),
        ),
      ),
    })),
  );

  return {
    eventId: event.id,
    title: event.title,
    eventDate: event.eventDate,
    parts,
    groups,
  };
}
