import { create } from "zustand";
import type { SlideContent } from "@/core/types";

export interface SetlistItem {
  id: string;
  label: string;
  slide: SlideContent;
}

export interface ServiceEvent {
  id: string;
  title: string;
  date: string;
  items: SetlistItem[];
}

interface SetlistState {
  events: ServiceEvent[];
  activeEventId: string | null;
  activeItemId: string | null;
  createEvent(title: string): void;
  selectItem(eventId: string, itemId: string): void;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const SEED: ServiceEvent = {
  id: "event-seed",
  title: "Culto de Domingo",
  date: new Date().toISOString().slice(0, 10),
  items: [
    {
      id: "item-boas-vindas",
      label: "Boas-vindas",
      slide: {
        id: "slide-boas-vindas",
        kind: "custom",
        title: "Boas-vindas",
        lines: ["Sejam bem-vindos", "à casa do Senhor"],
      },
    },
    {
      id: "item-louvor-1",
      label: "Louvor 1",
      slide: {
        id: "slide-louvor-1",
        kind: "lyric",
        title: "Louvor 1",
        lines: ["Grandes coisas", "estão por vir"],
      },
    },
  ],
};

export const useSetlistStore = create<SetlistState>((set) => ({
  events: [SEED],
  activeEventId: SEED.id,
  activeItemId: null,
  createEvent: (title) =>
    set((s) => {
      const event: ServiceEvent = {
        id: uid("event"),
        title,
        date: new Date().toISOString().slice(0, 10),
        items: [],
      };
      return { events: [...s.events, event], activeEventId: event.id };
    }),
  selectItem: (eventId, itemId) =>
    set({ activeEventId: eventId, activeItemId: itemId }),
}));
