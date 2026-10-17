import { create } from "zustand";
import {
  createEvent as createEventCommand,
  deleteEvent as deleteEventCommand,
  getEvent,
  getSong,
  listEvents,
  saveEvent,
} from "@/core/ipc/commands";
import { buildSongSlides } from "@/core/lib/lyrics";
import type {
  EventItem,
  EventPart,
  EventSummary,
  ServiceEvent,
  SlideContent,
  Song,
  SongSummary,
} from "@/core/types";
import { usePresentationStore } from "@/features/presentation/store";

interface SetlistState {
  events: EventSummary[];
  activeEventId: string | null;
  event: ServiceEvent | null;
  dirty: boolean;
  selectedItemId: string | null;
  songsCache: Record<string, Song>;
  runnerIndex: number | null;
  error: string | null;
  load(): Promise<void>;
  selectEvent(id: string): Promise<void>;
  createEvent(title: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  renameEvent(title: string): void;
  addPart(title: string): string;
  renamePart(partId: string, title: string): void;
  removePart(partId: string): void;
  movePart(partId: string, dir: -1 | 1): void;
  reorderParts(sourceIndex: number, targetIndex: number): void;
  addSong(partId: string, song: SongSummary): void;
  removeItem(itemId: string): void;
  moveItem(itemId: string, dir: -1 | 1): void;
  reorderItem(
    sourcePartId: string,
    sourceIndex: number,
    targetPartId: string,
    targetIndex: number,
  ): void;
  setNextItem(itemId: string, nextItemId: string | null): void;
  save(): Promise<void>;
  selectItem(itemId: string | null): void;
  loadItemSong(itemId: string): Promise<Song | null>;
  invalidateSong(songId: string, summary: SongSummary | null): void;
  projectSection(itemId: string, index: number): Promise<void>;
  projectNext(): Promise<void>;
  projectPrev(): Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function clearPointers(
  item: EventItem,
  removedIds: ReadonlySet<string>,
): EventItem {
  if (item.nextItemId === null || !removedIds.has(item.nextItemId)) return item;
  return { ...item, nextItemId: null };
}

export function findEventItem(
  event: ServiceEvent | null,
  itemId: string,
): EventItem | undefined {
  if (event === null) return undefined;
  for (const part of event.parts) {
    const item = part.items.find((candidate) => candidate.id === itemId);
    if (item !== undefined) return item;
  }
  return undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useSetlistStore = create<SetlistState>((set, get) => ({
  events: [],
  activeEventId: null,
  event: null,
  dirty: false,
  selectedItemId: null,
  songsCache: {},
  runnerIndex: null,
  error: null,

  load: async () => {
    try {
      let events = await listEvents();

      // Se não houver nenhuma programação, cria um temporário/padrão
      if (events.length === 0) {
        const id = crypto.randomUUID();
        const defaultEvent: ServiceEvent = {
          id,
          title: "Culto de Domingo",
          eventDate: today(),
          parts: [
            {
              id: crypto.randomUUID(),
              title: "Louvor",
              items: [],
            },
          ],
        };
        await createEventCommand(defaultEvent);
        events = await listEvents();
        set({
          events,
          event: defaultEvent,
          activeEventId: id,
          dirty: false,
          selectedItemId: null,
          error: null,
        });
        return;
      }

      set({ events, error: null });

      const currentActiveId = get().activeEventId;
      // Se houver apenas 1 evento ou se o evento ativo não existir mais, seleciona como padrão
      if (events.length === 1 || !currentActiveId || !events.some((e) => e.id === currentActiveId)) {
        await get().selectEvent(events[0].id);
      }
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  selectEvent: async (id) => {
    if (get().dirty) {
      await get().save();
      if (get().dirty) return;
    }
    try {
      const event = await getEvent(id);
      set({
        event,
        activeEventId: id,
        dirty: false,
        selectedItemId: null,
        error: null,
      });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  createEvent: async (title) => {
    if (get().dirty) {
      await get().save();
      if (get().dirty) return;
    }
    const id = crypto.randomUUID();
    try {
      await createEventCommand({
        id,
        title,
        eventDate: today(),
        parts: [],
      });
      await get().load();
      const event = await getEvent(id);
      set({
        event,
        activeEventId: id,
        dirty: false,
        selectedItemId: null,
        error: null,
      });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  deleteEvent: async (id) => {
    try {
      await deleteEventCommand(id);
    } catch (err) {
      set({ error: errorMessage(err) });
      return;
    }
    set({
      activeEventId: null,
      event: null,
      dirty: false,
      selectedItemId: null,
    });
    await get().load();
  },

  renameEvent: (title) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      return { event: { ...event, title }, dirty: true };
    }),

  addPart: (title) => {
    const { event } = get();
    if (event === null) return "";
    const id = crypto.randomUUID();
    const part: EventPart = { id, title, items: [] };
    set({ event: { ...event, parts: [...event.parts, part] }, dirty: true });
    return id;
  },

  renamePart: (partId, title) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      return {
        event: {
          ...event,
          parts: event.parts.map((part) =>
            part.id === partId ? { ...part, title } : part,
          ),
        },
        dirty: true,
      };
    }),

  removePart: (partId) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const removed = event.parts.find((part) => part.id === partId);
      if (removed === undefined) return {};
      const removedIds = new Set(removed.items.map((item) => item.id));
      const parts = event.parts
        .filter((part) => part.id !== partId)
        .map((part) => ({
          ...part,
          items: part.items.map((item) => clearPointers(item, removedIds)),
        }));
      return { event: { ...event, parts }, dirty: true };
    }),

  movePart: (partId, dir) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const index = event.parts.findIndex((part) => part.id === partId);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= event.parts.length) return {};
      const parts = [...event.parts];
      [parts[index], parts[target]] = [parts[target], parts[index]];
      return { event: { ...event, parts }, dirty: true };
    }),

  reorderParts: (sourceIndex, targetIndex) =>
    set((state) => {
      const { event } = state;
      if (!event || sourceIndex === targetIndex) return {};
      if (
        sourceIndex < 0 ||
        sourceIndex >= event.parts.length ||
        targetIndex < 0 ||
        targetIndex >= event.parts.length
      ) {
        return {};
      }
      const parts = [...event.parts];
      const [removed] = parts.splice(sourceIndex, 1);
      parts.splice(targetIndex, 0, removed);
      return { event: { ...event, parts }, dirty: true };
    }),

  addSong: (partId, song) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const item: EventItem = {
        id: crypto.randomUUID(),
        songId: song.id,
        nextItemId: null,
        song,
      };
      return {
        event: {
          ...event,
          parts: event.parts.map((part) =>
            part.id === partId
              ? { ...part, items: [...part.items, item] }
              : part,
          ),
        },
        dirty: true,
      };
    }),

  removeItem: (itemId) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      let removed = false;
      const parts = event.parts.map((part) => ({
        ...part,
        items: part.items
          .filter((item) => {
            if (item.id === itemId) {
              removed = true;
              return false;
            }
            return true;
          })
          .map((item) =>
            item.nextItemId === itemId ? { ...item, nextItemId: null } : item,
          ),
      }));
      if (!removed) return {};
      return { event: { ...event, parts }, dirty: true };
    }),

  moveItem: (itemId, dir) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      for (const part of event.parts) {
        const index = part.items.findIndex((item) => item.id === itemId);
        if (index === -1) continue;
        const target = index + dir;
        if (target < 0 || target >= part.items.length) return {};
        const items = [...part.items];
        [items[index], items[target]] = [items[target], items[index]];
        const parts = event.parts.map((p) =>
          p.id === part.id ? { ...p, items } : p,
        );
        return { event: { ...event, parts }, dirty: true };
      }
      return {};
    }),

  reorderItem: (sourcePartId, sourceIndex, targetPartId, targetIndex) =>
    set((state) => {
      const { event } = state;
      if (!event) return {};
      const parts = event.parts.map((p) => ({ ...p, items: [...p.items] }));
      const srcPart = parts.find((p) => p.id === sourcePartId);
      const dstPart = parts.find((p) => p.id === targetPartId);
      if (!srcPart || !dstPart) return {};
      if (sourceIndex < 0 || sourceIndex >= srcPart.items.length) return {};

      const [item] = srcPart.items.splice(sourceIndex, 1);
      if (!item) return {};

      const safeTarget = Math.max(0, Math.min(dstPart.items.length, targetIndex));
      dstPart.items.splice(safeTarget, 0, item);
      return { event: { ...event, parts }, dirty: true };
    }),

  setNextItem: (itemId, nextItemId) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const parts = event.parts.map((part) => ({
        ...part,
        items: part.items.map((item) =>
          item.id === itemId ? { ...item, nextItemId } : item,
        ),
      }));
      return { event: { ...event, parts }, dirty: true };
    }),

  save: async () => {
    const { event } = get();
    if (event === null) return;
    try {
      await saveEvent(event);
      set({ dirty: false, error: null });
      await get().load();
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  selectItem: (itemId) => {
    set({ selectedItemId: itemId, runnerIndex: null });
    if (itemId !== null) void get().loadItemSong(itemId);
  },

  loadItemSong: async (itemId) => {
    const item = findEventItem(get().event, itemId);
    if (item === undefined || item.song === null) return null;
    const cached = get().songsCache[item.songId];
    if (cached !== undefined) return cached;
    try {
      const song = await getSong(item.songId);
      if (song === null) {
        set({ error: "Música não encontrada." });
        return null;
      }
      set((state) => ({
        songsCache: { ...state.songsCache, [song.id]: song },
      }));
      return song;
    } catch (err) {
      set({ error: errorMessage(err) });
      return null;
    }
  },

  invalidateSong: (songId, summary) =>
    set((state) => {
      const songsCache = Object.fromEntries(
        Object.entries(state.songsCache).filter(([id]) => id !== songId),
      );
      const { event } = state;
      if (event === null) return { songsCache };
      const parts = event.parts.map((part) => ({
        ...part,
        items: part.items.map((item) =>
          item.songId === songId ? { ...item, song: summary } : item,
        ),
      }));
      return { songsCache, event: { ...event, parts } };
    }),

  projectSection: async (itemId, index) => {
    const song = await get().loadItemSong(itemId);
    if (song === null) return;
    const slides = buildSongSlides(song);
    if (index < 0 || index >= slides.length) return;

    let nextUp: SlideContent | null = null;
    if (index + 1 < slides.length) {
      nextUp = slides[index + 1].slide;
    } else {
      const event = get().event;
      const item = findEventItem(event, itemId);
      const nextItem =
        item !== undefined && item.nextItemId !== null
          ? findEventItem(event, item.nextItemId)
          : undefined;
      if (nextItem !== undefined && nextItem.song !== null) {
        const nextSong = await get().loadItemSong(nextItem.id);
        if (nextSong !== null) {
          nextUp = buildSongSlides(nextSong)[0]?.slide ?? null;
        }
      }
    }

    set({ runnerIndex: index });
    await usePresentationStore
      .getState()
      .publishLive(slides[index].slide, nextUp);
  },

  projectNext: async () => {
    const { selectedItemId, runnerIndex } = get();
    if (selectedItemId === null) return;
    if (runnerIndex === null) {
      await get().projectSection(selectedItemId, 0);
      return;
    }
    const song = await get().loadItemSong(selectedItemId);
    if (song === null) return;
    const slides = buildSongSlides(song);
    if (runnerIndex + 1 >= slides.length) return;
    await get().projectSection(selectedItemId, runnerIndex + 1);
  },

  projectPrev: async () => {
    const { selectedItemId, runnerIndex } = get();
    if (selectedItemId === null || runnerIndex === null || runnerIndex === 0) {
      return;
    }
    await get().projectSection(selectedItemId, runnerIndex - 1);
  },
}));
