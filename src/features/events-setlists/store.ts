import { create } from "zustand";
import {
  createEvent as createEventCommand,
  deleteEvent as deleteEventCommand,
  getEvent,
  listEvents,
  saveEvent,
} from "@/core/ipc/commands";
import type {
  EventItem,
  EventPart,
  EventSummary,
  ServiceEvent,
} from "@/core/types";
import { useSongsStore } from "@/features/songs/store";

interface SetlistState {
  events: EventSummary[];
  activeEventId: string | null;
  event: ServiceEvent | null;
  dirty: boolean;
  selectedItemId: string | null;
  error: string | null;
  load(): Promise<void>;
  selectEvent(id: string): Promise<void>;
  createEvent(title: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  renameEvent(title: string): void;
  addPart(title: string): void;
  renamePart(partId: string, title: string): void;
  removePart(partId: string): void;
  movePart(partId: string, dir: -1 | 1): void;
  addSong(partId: string, songId: string): void;
  removeItem(itemId: string): void;
  moveItem(itemId: string, dir: -1 | 1): void;
  setNextItem(itemId: string, nextItemId: string | null): void;
  save(): Promise<void>;
  selectItem(itemId: string | null): void;
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useSetlistStore = create<SetlistState>((set, get) => ({
  events: [],
  activeEventId: null,
  event: null,
  dirty: false,
  selectedItemId: null,
  error: null,

  load: async () => {
    try {
      const events = await listEvents();
      set({ events, error: null });
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
    await get().load();
    if (get().activeEventId === id) {
      set({
        activeEventId: null,
        event: null,
        dirty: false,
        selectedItemId: null,
      });
    }
  },

  renameEvent: (title) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      return { event: { ...event, title }, dirty: true };
    }),

  addPart: (title) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const part: EventPart = { id: crypto.randomUUID(), title, items: [] };
      return { event: { ...event, parts: [...event.parts, part] }, dirty: true };
    }),

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

  addSong: (partId, songId) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const song =
        useSongsStore.getState().songs.find((s) => s.id === songId) ?? null;
      const item: EventItem = {
        id: crypto.randomUUID(),
        songId,
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

  selectItem: (itemId) => set({ selectedItemId: itemId }),
}));
