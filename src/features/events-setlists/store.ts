import { create } from "zustand";
import {
  createEvent as createEventCommand,
  deleteEvent as deleteEventCommand,
  getEvent,
  getBibleChapter,
  getSong,
  getTemporaryEvent,
  listEvents,
  saveEvent,
} from "@/core/ipc/commands";
import { buildSongSlides } from "@/core/lib/lyrics";
import { buildMediaSlides } from "@/core/lib/media";
import { useSongDefaultsStore } from "@/core/store/songDefaultsStore";
import {
  bibleSplitThreshold,
  buildScriptureSlides,
} from "@/core/lib/biblePresentation";
import {
  type EventItem,
  type EventPart,
  type EventSummary,
  type MediaItem,
  type ScriptureRef,
  type ServiceEvent,
  type SetlistListMode,
  type SlideContent,
  type Song,
  type SongSummary,
  TEMPORARY_EVENT_ID,
} from "@/core/types";
import { usePresentationStore } from "@/features/presentation/store";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { appendItemToEvent, transferItemBetweenEvents } from "./temporaryUtils";

export type RecurrenceFrequency = "none" | "weekly" | "biweekly" | "monthly";

export type MonthlyRecurrenceMode = "day_of_month" | "nth_weekday";

export interface CreateRecurringEventParams {
  title: string;
  startDate: string;
  recurrence: RecurrenceFrequency;
  weekdays?: number[];
  monthlyMode?: MonthlyRecurrenceMode;
  monthlyNth?: number;
  monthlyWeekday?: number;
  endMode?: "until_date" | "count";
  untilDate?: string;
  count?: number;
  themeGuid?: string | null;
}

interface SetlistState {
  events: EventSummary[];
  activeEventId: string | null;
  event: ServiceEvent | null;
  dirty: boolean;
  selectedItemId: string | null;
  songsCache: Record<string, Song>;
  runnerIndex: number | null;
  error: string | null;
  agendaOpen: boolean;
  newEventDialogOpen: boolean;
  newEventInitialDate: string | null;
  newEventSelectOnCreate: boolean;
  openAgenda(): void;
  closeAgenda(): void;
  openNewEventDialog(initialDate?: string, selectOnCreate?: boolean): void;
  closeNewEventDialog(): void;
  load(): Promise<void>;
  selectEvent(id: string): Promise<void>;
  createEvent(title: string, eventDate?: string): Promise<string | undefined>;
  createRecurringEvents(params: CreateRecurringEventParams): Promise<string[]>;
  updateEventDate(id: string, newDate: string): Promise<void>;
  updateEventDetails(
    id: string,
    updates: {
      title?: string;
      eventDate?: string;
      wallpaper?: string | null;
      themeGuid?: string | null;
    },
  ): Promise<void>;
  updateRecurringSeries(
    matchTitle: string,
    updates: { title?: string; timeInterval?: string; wallpaper?: string | null },
  ): Promise<void>;
  deleteRecurringSeries(matchTitle: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  renameEvent(title: string): void;
  addPart(title?: string, style?: { color?: string | null; bgColor?: string | null }): string;
  renamePart(partId: string, title: string): void;
  updatePartStyle(
    partId: string,
    style: { color?: string | null; bgColor?: string | null },
  ): void;
  removePart(partId: string): void;
  movePart(partId: string, dir: -1 | 1): void;
  reorderParts(sourceIndex: number, targetIndex: number): void;
  addSong(partId: string, song: SongSummary): string;
  addMedia(partId: string, media: MediaItem): string;
  addScripture(partId: string, scripture: ScriptureRef): string;
  updateMedia(itemId: string, media: MediaItem): void;
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
  shiftRunnerIndex(delta: -1 | 1, addEmptySlideAtStart: boolean): void;
  listMode: SetlistListMode;
  lastSelectedEventId: string | null;
  temporaryEvent: ServiceEvent | null;
  switchListMode(mode: SetlistListMode): Promise<void>;
  clearTemporary(): Promise<void>;
  clearEventItems(): void;
  moveItemToOtherList(itemId: string): Promise<void>;
  appendImprevistoSong(songId: string): Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildSongRunnerSlides(song: Song) {
  return buildSongSlides(song, {
    addEmptySlideAtStart:
      useSongDefaultsStore.getState().addEmptySlideAtStart,
  });
}

function clearPointers(
  item: EventItem,
  removedIds: ReadonlySet<string>,
): EventItem {
  if (item.nextItemId === null || !removedIds.has(item.nextItemId)) return item;
  return { ...item, nextItemId: null };
}

function insertItemInEvent(
  event: ServiceEvent,
  partId: string,
  item: EventItem,
): ServiceEvent {
  if (event.parts.length === 0) {
    return {
      ...event,
      parts: [{ id: crypto.randomUUID(), title: "", items: [item] }],
    };
  }

  if (event.parts.some((part) => part.id === partId)) {
    return {
      ...event,
      parts: event.parts.map((part) =>
        part.id === partId ? { ...part, items: [...part.items, item] } : part,
      ),
    };
  }

  return {
    ...event,
    parts: event.parts.map((part, index) =>
      index === 0 ? { ...part, items: [...part.items, item] } : part,
    ),
  };
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

export async function buildScriptureItemSlides(
  item: EventItem,
): Promise<SlideContent[]> {
  const ref = item.scripture;
  if (!ref) return [];
  try {
    const verses = await getBibleChapter(ref.versionId, ref.bookId, ref.chapter);
    const verse = verses.find((candidate) => candidate.verse === ref.verse);
    if (!verse) return [];
    return buildScriptureSlides({
      versionId: ref.versionId,
      bookId: ref.bookId,
      bookName: ref.bookName,
      chapter: ref.chapter,
      verse: ref.verse,
      text: verse.text,
      threshold: bibleSplitThreshold(),
    });
  } catch {
    return [];
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function pickNextUpcomingEvent(events: EventSummary[]): EventSummary | null {
  if (events.length === 0) return null;
  const now = Date.now();

  const parsed = events.map((e) => {
    let startStr = e.eventDate;
    let endStr = "";
    if (e.eventDate.includes("/")) {
      const parts = e.eventDate.split("/");
      startStr = parts[0];
      endStr = parts[1];
    }
    const hasTime = startStr.includes("T");
    const startTime = hasTime
      ? new Date(startStr).getTime()
      : new Date(`${startStr}T00:00:00`).getTime();
    let endTime: number;
    if (endStr && endStr.includes("T")) {
      endTime = new Date(endStr).getTime();
    } else if (hasTime) {
      endTime = startTime + 2 * 60 * 60 * 1000;
    } else {
      endTime = new Date(`${startStr}T23:59:59`).getTime();
    }

    return {
      event: e,
      hasTime,
      startTime: isNaN(startTime) ? 0 : startTime,
      endTime: isNaN(endTime) ? startTime + 2 * 60 * 60 * 1000 : endTime,
    };
  });

  parsed.sort((a, b) => a.startTime - b.startTime);

  // 1. Events starting soon (within 15 min ago or later in future)
  const soonOrFuture = parsed.filter((p) => p.startTime >= now - 15 * 60 * 1000);
  if (soonOrFuture.length > 0) {
    return soonOrFuture[0].event;
  }

  // 2. Event currently in progress
  const inProgress = parsed.find((p) => p.startTime <= now && p.endTime >= now);
  if (inProgress) {
    return inProgress.event;
  }

  // 3. Fallback: most recent event
  return parsed[parsed.length - 1].event;
}

export function getNthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  if (nth > 0) {
    const first = new Date(year, month, 1);
    const diff = (weekday - first.getDay() + 7) % 7;
    const day = 1 + diff + (nth - 1) * 7;
    return new Date(year, month, day);
  } else {
    const last = new Date(year, month + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    const day = last.getDate() - diff;
    return new Date(year, month, day);
  }
}

export function generateRecurrenceDates(params: CreateRecurringEventParams): string[] {
  const dates: string[] = [];
  let startRaw = params.startDate;
  let endRaw: string | null = null;
  if (params.startDate.includes("/")) {
    const parts = params.startDate.split("/");
    startRaw = parts[0];
    endRaw = parts[1];
  }

  const baseDate = new Date(startRaw);
  if (isNaN(baseDate.getTime())) return [];

  const hasTime = startRaw.includes("T");
  const pad = (n: number) => String(n).padStart(2, "0");

  let intervalDurationMs = 0;
  if (endRaw && endRaw.includes("T")) {
    const endBaseDate = new Date(endRaw);
    if (!isNaN(endBaseDate.getTime())) {
      intervalDurationMs = Math.max(0, endBaseDate.getTime() - baseDate.getTime());
    }
  }

  function formatDateTimeStr(d: Date): string {
    if (hasTime) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatEventInterval(d: Date): string {
    const startStr = formatDateTimeStr(d);
    if (intervalDurationMs > 0 && hasTime) {
      const endD = new Date(d.getTime() + intervalDurationMs);
      const endStr = formatDateTimeStr(endD);
      return `${startStr}/${endStr}`;
    }
    return startStr;
  }

  if (params.recurrence === "none") {
    return [formatEventInterval(baseDate)];
  }

  const endLimit =
    params.endMode === "until_date" && params.untilDate
      ? new Date(`${params.untilDate}T23:59:59`).getTime()
      : null;
  const maxCount =
    params.endMode === "count" && params.count ? Math.max(1, params.count) : 104; // Safety max (up to 2 years)

  if (params.recurrence === "weekly" || params.recurrence === "biweekly") {
    const stepWeeks = params.recurrence === "weekly" ? 1 : 2;
    const weekdays =
      params.weekdays && params.weekdays.length > 0
        ? [...params.weekdays].sort((a, b) => a - b)
        : [baseDate.getDay()];

    const currentWeekStart = new Date(baseDate);
    currentWeekStart.setDate(baseDate.getDate() - baseDate.getDay());
    currentWeekStart.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);

    for (let w = 0; w < 104; w += stepWeeks) {
      for (const wday of weekdays) {
        const candidate = new Date(currentWeekStart);
        candidate.setDate(currentWeekStart.getDate() + w * 7 + wday);

        // Skip days before start date (1 minute tolerance)
        if (candidate.getTime() < baseDate.getTime() - 60000) continue;

        if (endLimit && candidate.getTime() > endLimit) return dates;
        dates.push(formatEventInterval(candidate));
        if (dates.length >= maxCount) return dates;
      }
    }
  } else if (params.recurrence === "monthly") {
    let year = baseDate.getFullYear();
    let month = baseDate.getMonth();

    for (let m = 0; m < 60; m++) {
      let candidate: Date;
      if (params.monthlyMode === "nth_weekday") {
        const nth = params.monthlyNth ?? 1;
        const weekday = params.monthlyWeekday ?? baseDate.getDay();
        candidate = getNthWeekdayOfMonth(year, month, weekday, nth);
        candidate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
      } else {
        const targetDay = baseDate.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const day = Math.min(targetDay, daysInMonth);
        candidate = new Date(year, month, day, baseDate.getHours(), baseDate.getMinutes(), 0, 0);
      }

      month++;
      if (month > 11) {
        month = 0;
        year++;
      }

      if (candidate.getTime() < baseDate.getTime() - 60000) continue;
      if (endLimit && candidate.getTime() > endLimit) return dates;
      dates.push(formatEventInterval(candidate));
      if (dates.length >= maxCount) return dates;
    }
  }

  return dates;
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
  agendaOpen: false,
  newEventDialogOpen: false,
  newEventInitialDate: null,
  newEventSelectOnCreate: true,
  listMode: "event",
  lastSelectedEventId: null,
  temporaryEvent: null,

  openAgenda: () => set({ agendaOpen: true }),
  closeAgenda: () => set({ agendaOpen: false }),
  openNewEventDialog: (initialDate, selectOnCreate = true) =>
    set({
      newEventDialogOpen: true,
      newEventInitialDate: initialDate || null,
      newEventSelectOnCreate: selectOnCreate,
    }),
  closeNewEventDialog: () =>
    set({
      newEventDialogOpen: false,
      newEventInitialDate: null,
      newEventSelectOnCreate: true,
    }),

  load: async () => {
    try {
      let events = await listEvents();
      let temporaryEvent: ServiceEvent | null = null;
      try {
        temporaryEvent = await getTemporaryEvent();
      } catch (err) {
        console.error("Falha ao carregar temporário:", err);
      }
      set({ temporaryEvent });

      if (get().listMode === "temporary") {
        set({
          events,
          event: temporaryEvent,
          activeEventId: TEMPORARY_EVENT_ID,
          error: null,
        });
        useSlideThemesStore.getState().setEventThemeGuid(null);
        return;
      }

      if (events.length === 0) {
        set({
          events,
          listMode: "temporary",
          event: temporaryEvent,
          activeEventId: TEMPORARY_EVENT_ID,
          lastSelectedEventId: null,
          dirty: false,
          selectedItemId: null,
          error: null,
        });
        useSlideThemesStore.getState().setEventThemeGuid(null);
        return;
      }

      set({ events, error: null });

      const currentActiveId = get().activeEventId;
      // Seleciona o próximo evento baseado em data/horário caso não haja nenhum selecionado ou não exista mais
      if (!currentActiveId || !events.some((e) => e.id === currentActiveId)) {
        const nextEvent = pickNextUpcomingEvent(events);
        if (nextEvent) {
          await get().selectEvent(nextEvent.id);
        } else if (events.length > 0) {
          await get().selectEvent(events[0].id);
        }
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
        listMode: "event",
        lastSelectedEventId: id,
        event,
        activeEventId: id,
        dirty: false,
        selectedItemId: null,
        error: null,
      });
      useSlideThemesStore.getState().setEventThemeGuid(event?.themeGuid ?? null);

      // Synchronize event-specific wallpaper or fall back to public default
      if (event?.wallpaper) {
        useWallpaperStore.getState().applyRemote(event.wallpaper);
      } else {
        const defaultWp = useOutputManagerStore.getState().configs.public?.wallpaper;
        useWallpaperStore.getState().applyRemote(defaultWp ?? null);
      }
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  switchListMode: async (mode) => {
    if (get().listMode === mode) return;

    if (get().dirty) {
      await get().save();
      if (get().dirty) return;
    }

    if (mode === "temporary") {
      const currentActiveId = get().activeEventId;
      if (currentActiveId && currentActiveId !== TEMPORARY_EVENT_ID) {
        set({ lastSelectedEventId: currentActiveId });
      }

      let temp = get().temporaryEvent;
      try {
        temp = await getTemporaryEvent();
        set({ temporaryEvent: temp });
      } catch (err) {
        set({ error: errorMessage(err) });
      }

      set({
        listMode: "temporary",
        activeEventId: TEMPORARY_EVENT_ID,
        event: temp,
        dirty: false,
        selectedItemId: null,
        runnerIndex: null,
      });
      useSlideThemesStore.getState().setEventThemeGuid(null);

      if (temp?.wallpaper) {
        useWallpaperStore.getState().applyRemote(temp.wallpaper);
      } else {
        const defaultWp = useOutputManagerStore.getState().configs.public?.wallpaper;
        useWallpaperStore.getState().applyRemote(defaultWp ?? null);
      }
    } else {
      set({ listMode: "event" });
      const targetId = get().lastSelectedEventId || get().events[0]?.id;
      if (targetId) {
        await get().selectEvent(targetId);
      } else {
        await get().load();
      }
    }
  },

  clearTemporary: async () => {
    const emptyTemp: ServiceEvent = {
      id: TEMPORARY_EVENT_ID,
      title: "Temporário",
      eventDate: "",
      wallpaper: null,
      parts: [],
    };
    try {
      await saveEvent(emptyTemp);
      set({
        temporaryEvent: emptyTemp,
        ...(get().listMode === "temporary"
          ? {
              event: emptyTemp,
              dirty: false,
              selectedItemId: null,
              runnerIndex: null,
            }
          : {}),
      });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  clearEventItems: () =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const parts = event.parts.map((part) => ({ ...part, items: [] }));
      return {
        event: { ...event, parts },
        dirty: true,
        selectedItemId: null,
        runnerIndex: null,
      };
    }),

  moveItemToOtherList: async (itemId) => {
    const state = get();
    const currentEvent = state.event;
    if (!currentEvent) return;

    if (state.listMode === "event") {
      let targetTemp = state.temporaryEvent;
      if (!targetTemp) {
        try {
          targetTemp = await getTemporaryEvent();
        } catch {
          return;
        }
      }
      const transfer = transferItemBetweenEvents(currentEvent, targetTemp, itemId);
      if (!transfer) return;

      try {
        await saveEvent(transfer.updatedTarget);
        set({
          temporaryEvent: transfer.updatedTarget,
          event: transfer.updatedSource,
          dirty: false,
          selectedItemId: state.selectedItemId === itemId ? null : state.selectedItemId,
        });
        await saveEvent(transfer.updatedSource);
      } catch (err) {
        set({ error: errorMessage(err) });
      }
    } else {
      const targetEventId = state.lastSelectedEventId || state.events[0]?.id;
      if (!targetEventId) return;

      const targetEvent = await getEvent(targetEventId);
      if (!targetEvent) return;

      const transfer = transferItemBetweenEvents(currentEvent, targetEvent, itemId);
      if (!transfer) return;

      try {
        await saveEvent(transfer.updatedTarget);
        set({
          temporaryEvent: transfer.updatedSource,
          event: transfer.updatedSource,
          dirty: false,
          selectedItemId: state.selectedItemId === itemId ? null : state.selectedItemId,
        });
        await saveEvent(transfer.updatedSource);
      } catch (err) {
        set({ error: errorMessage(err) });
      }
    }
  },

  createEvent: async (title, eventDate) => {
    if (get().dirty) {
      await get().save();
      if (get().dirty) return undefined;
    }
    const id = crypto.randomUUID();
    try {
      await createEventCommand({
        id,
        title,
        eventDate: eventDate || today(),
        parts: [],
      });
      await get().load();
      await get().selectEvent(id);
      return id;
    } catch (err) {
      set({ error: errorMessage(err) });
      return undefined;
    }
  },

  createRecurringEvents: async (params) => {
    if (get().dirty) {
      await get().save();
      if (get().dirty) return [];
    }

    const dates = generateRecurrenceDates(params);
    const createdIds: string[] = [];

    for (const dateStr of dates) {
      const id = crypto.randomUUID();
      const newEvent: ServiceEvent = {
        id,
        title: params.title.trim(),
        eventDate: dateStr,
        themeGuid: params.themeGuid ?? null,
        parts: [], // Setlist separado e independente
      };

      await createEventCommand(newEvent);
      createdIds.push(id);
    }

    await get().load();
    if (get().newEventSelectOnCreate && createdIds.length > 0) {
      await get().selectEvent(createdIds[0]);
    }
    return createdIds;
  },

  updateEventDate: async (id, newDate) => {
    try {
      const current = get().event;
      if (current && current.id === id) {
        const updated = { ...current, eventDate: newDate };
        await saveEvent(updated);
        set({
          event: updated,
          events: get().events.map((e) => (e.id === id ? { ...e, eventDate: newDate } : e)),
        });
      } else {
        const ev = await getEvent(id);
        if (ev) {
          const updated = { ...ev, eventDate: newDate };
          await saveEvent(updated);
          set({
            events: get().events.map((e) => (e.id === id ? { ...e, eventDate: newDate } : e)),
          });
        }
      }
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  updateEventDetails: async (id, updates) => {
    try {
      const current = get().event;
      if (current && current.id === id) {
        const updated: ServiceEvent = {
          ...current,
          title: updates.title !== undefined ? updates.title.trim() : current.title,
          eventDate: updates.eventDate !== undefined ? updates.eventDate : current.eventDate,
          wallpaper: updates.wallpaper !== undefined ? updates.wallpaper : current.wallpaper,
          themeGuid:
            updates.themeGuid !== undefined ? updates.themeGuid : current.themeGuid,
        };
        await saveEvent(updated);
        set({
          event: updated,
          events: get().events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  title: updated.title,
                  eventDate: updated.eventDate,
                  wallpaper: updated.wallpaper,
                  themeGuid: updated.themeGuid,
                }
              : e,
          ),
        });
        if (updates.wallpaper !== undefined) {
          useWallpaperStore.getState().applyRemote(updates.wallpaper);
        }
        useSlideThemesStore.getState().setEventThemeGuid(updated.themeGuid ?? null);
      } else {
        const ev = await getEvent(id);
        if (ev) {
          const updated: ServiceEvent = {
            ...ev,
            title: updates.title !== undefined ? updates.title.trim() : ev.title,
            eventDate: updates.eventDate !== undefined ? updates.eventDate : ev.eventDate,
            wallpaper: updates.wallpaper !== undefined ? updates.wallpaper : ev.wallpaper,
            themeGuid:
              updates.themeGuid !== undefined ? updates.themeGuid : ev.themeGuid,
          };
          await saveEvent(updated);
          set({
            events: get().events.map((e) =>
              e.id === id
                ? {
                    ...e,
                    title: updated.title,
                    eventDate: updated.eventDate,
                    wallpaper: updated.wallpaper,
                    themeGuid: updated.themeGuid,
                  }
                : e,
            ),
          });
          if (get().activeEventId === id && updates.wallpaper !== undefined) {
            useWallpaperStore.getState().applyRemote(updates.wallpaper);
          }
          if (get().activeEventId === id) {
            useSlideThemesStore.getState().setEventThemeGuid(updated.themeGuid ?? null);
          }
        }
      }
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  updateRecurringSeries: async (matchTitle, updates) => {
    try {
      const events = get().events;
      const matching = events.filter((e) => e.title === matchTitle);
      for (const summary of matching) {
        const ev = await getEvent(summary.id);
        if (!ev) continue;

        let newEventDate = ev.eventDate;
        if (updates.timeInterval) {
          const datePart = ev.eventDate.split("T")[0];
          if (updates.timeInterval.includes("/")) {
            const [startTime, endTime] = updates.timeInterval.split("/");
            newEventDate = `${datePart}T${startTime}/${datePart}T${endTime}`;
          } else {
            newEventDate = `${datePart}T${updates.timeInterval}`;
          }
        }

        const updated: ServiceEvent = {
          ...ev,
          title: updates.title !== undefined ? updates.title.trim() : ev.title,
          eventDate: newEventDate,
          wallpaper: updates.wallpaper !== undefined ? updates.wallpaper : ev.wallpaper,
        };

        await saveEvent(updated);
      }

      await get().load();

      const activeId = get().activeEventId;
      if (activeId) {
        const refreshed = await getEvent(activeId);
        if (refreshed) {
          set({ event: refreshed });
          if (refreshed.wallpaper !== undefined) {
            useWallpaperStore.getState().applyRemote(refreshed.wallpaper);
          }
        }
      }
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  deleteRecurringSeries: async (matchTitle) => {
    try {
      const matching = get().events.filter((e) => e.title === matchTitle);
      for (const summary of matching) {
        await deleteEventCommand(summary.id);
      }
      set({ activeEventId: null, event: null });
      await get().load();
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  deleteEvent: async (id) => {
    if (id === TEMPORARY_EVENT_ID) return;
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
    useSlideThemesStore.getState().setEventThemeGuid(null);
    await get().load();
  },

  renameEvent: (title) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      return { event: { ...event, title }, dirty: true };
    }),

  addPart: (title = "", style) => {
    const { event } = get();
    if (event === null) return "";
    const id = crypto.randomUUID();
    const part: EventPart = {
      id,
      title,
      items: [],
      color: style?.color ?? null,
      bgColor: style?.bgColor ?? null,
    };
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

  updatePartStyle: (partId, style) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      return {
        event: {
          ...event,
          parts: event.parts.map((part) =>
            part.id === partId
              ? {
                  ...part,
                  color: style.color !== undefined ? style.color : part.color,
                  bgColor:
                    style.bgColor !== undefined ? style.bgColor : part.bgColor,
                }
              : part,
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

  addSong: (partId, song) => {
    const id = crypto.randomUUID();
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const item: EventItem = {
        id,
        songId: song.id,
        nextItemId: null,
        song,
        media: null,
      };
      return { event: insertItemInEvent(event, partId, item), dirty: true };
    });
    return id;
  },

  addMedia: (partId, media) => {
    const id = crypto.randomUUID();
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const item: EventItem = {
        id,
        songId: null,
        nextItemId: null,
        song: null,
        media,
      };
      return { event: insertItemInEvent(event, partId, item), dirty: true };
    });
    return id;
  },

  addScripture: (partId, scripture) => {
    const id = crypto.randomUUID();
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const item: EventItem = {
        id,
        songId: null,
        nextItemId: null,
        song: null,
        media: null,
        scripture,
      };
      return { event: insertItemInEvent(event, partId, item), dirty: true };
    });
    return id;
  },

  updateMedia: (itemId, media) =>
    set((state) => {
      const { event } = state;
      if (event === null) return {};
      const parts = event.parts.map((part) => ({
        ...part,
        items: part.items.map((item) =>
          item.id === itemId ? { ...item, media } : item,
        ),
      }));
      return { event: { ...event, parts }, dirty: true };
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
    const { event, listMode } = get();
    if (event === null) return;
    try {
      await saveEvent(event);
      set({
        dirty: false,
        error: null,
        ...(listMode === "temporary" ? { temporaryEvent: event } : {}),
      });
      await get().load();
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  selectItem: (itemId) => {
    set({ selectedItemId: itemId, runnerIndex: null });
    if (itemId === null) return;
    const item = findEventItem(get().event, itemId);
    if (item?.scripture) {
      void buildScriptureItemSlides(item).then((slides) => {
        usePresentationStore.getState().setPreview(slides[0] ?? null);
      });
      return;
    }
    if (item?.media) {
      const slides = buildMediaSlides(item.id, item.media);
      usePresentationStore.getState().setPreview(slides[0]?.slide ?? null);
      return;
    }
    void get().loadItemSong(itemId);
  },

  loadItemSong: async (itemId) => {
    const item = findEventItem(get().event, itemId);
    if (item === undefined || item.song == null || item.songId == null) {
      return null;
    }
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
    const event = get().event;
    const item = findEventItem(event, itemId);
    if (item === undefined) return;

    let slides: SlideContent[];
    if (item.scripture) {
      slides = await buildScriptureItemSlides(item);
    } else if (item.media != null) {
      slides = buildMediaSlides(item.id, item.media).map((entry) => entry.slide);
    } else {
      const song = await get().loadItemSong(itemId);
      if (song === null) return;
      slides = buildSongRunnerSlides(song).map((entry) => entry.slide);
    }
    if (index < 0 || index >= slides.length) return;

    let nextUp: SlideContent | null = null;
    if (index + 1 < slides.length) {
      nextUp = slides[index + 1];
    } else if (item.nextItemId !== null) {
      const nextItem = findEventItem(event, item.nextItemId);
      if (nextItem !== undefined) {
        if (nextItem.scripture) {
          nextUp = (await buildScriptureItemSlides(nextItem))[0] ?? null;
        } else if (nextItem.media != null) {
          nextUp = buildMediaSlides(nextItem.id, nextItem.media)[0]?.slide ?? null;
        } else if (nextItem.song != null) {
          const nextSong = await get().loadItemSong(nextItem.id);
          if (nextSong !== null) {
            nextUp = buildSongRunnerSlides(nextSong)[0]?.slide ?? null;
          }
        }
      }
    }

    set({ runnerIndex: index });
    await usePresentationStore.getState().publishLive(slides[index], nextUp);
  },

  projectNext: async () => {
    const { selectedItemId, runnerIndex } = get();
    if (selectedItemId === null) return;
    if (runnerIndex === null) {
      await get().projectSection(selectedItemId, 0);
      return;
    }
    const item = findEventItem(get().event, selectedItemId);
    if (item === undefined) return;

    let count: number;
    if (item.scripture) {
      count = (await buildScriptureItemSlides(item)).length;
    } else if (item.media != null) {
      count = buildMediaSlides(item.id, item.media).length;
    } else {
      const song = await get().loadItemSong(selectedItemId);
      if (song === null) return;
      count = buildSongRunnerSlides(song).length;
    }
    if (runnerIndex + 1 >= count) return;
    await get().projectSection(selectedItemId, runnerIndex + 1);
  },

  projectPrev: async () => {
    const { selectedItemId, runnerIndex } = get();
    if (selectedItemId === null || runnerIndex === null || runnerIndex === 0) {
      return;
    }
    await get().projectSection(selectedItemId, runnerIndex - 1);
  },

  shiftRunnerIndex: (delta, addEmptySlideAtStart) => {
    const current = get().runnerIndex;
    if (current === null) return;
    if (!addEmptySlideAtStart && current === 0) {
      set({ runnerIndex: 0 });
      return;
    }
    set({ runnerIndex: Math.max(0, current + delta) });
  },

  appendImprevistoSong: async (songId) => {
    let song = get().songsCache[songId];
    if (!song) {
      const fetched = await getSong(songId);
      if (!fetched) return;
      song = fetched;
      set((s) => ({
        songsCache: { ...s.songsCache, [songId]: fetched },
      }));
    }

    const { event, listMode } = get();
    if (!event) return;

    const summary: SongSummary = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      composer: song.composer,
      songKey: song.songKey,
      bpm: song.bpm,
    };

    const newItem: EventItem = {
      id: crypto.randomUUID(),
      songId: song.id,
      nextItemId: null,
      song: summary,
      media: null,
    };

    const updatedEvent = appendItemToEvent(event, newItem);

    if (listMode === "temporary") {
      set({
        event: updatedEvent,
        temporaryEvent: updatedEvent,
        dirty: false,
      });
    } else {
      set({
        event: updatedEvent,
        dirty: false,
      });
    }

    try {
      await saveEvent(updatedEvent);
    } catch (err) {
      console.error("Falha ao salvar evento após imprevisto do remote:", err);
    }
  },
}));
