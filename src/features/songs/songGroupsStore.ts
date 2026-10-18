import { create } from "zustand";
import type { SectionType } from "@/core/types";

export interface SongGroupConfig {
  id: string;
  name: string;
  color: string;
  shortcut: string;
  typeKey?: SectionType;
}

export const DEFAULT_SONG_GROUPS: SongGroupConfig[] = [
  { id: "intro", name: "Introdução", color: "#22c55e", shortcut: "I", typeKey: "intro" },
  { id: "verse", name: "Verso", color: "#3b82f6", shortcut: "V", typeKey: "verse" },
  { id: "pre-chorus", name: "Pré-refrão", color: "#06b6d4", shortcut: "P", typeKey: "pre-chorus" },
  { id: "chorus", name: "Refrão", color: "#ef4444", shortcut: "C", typeKey: "chorus" },
  { id: "bridge", name: "Ponte", color: "#a855f7", shortcut: "B", typeKey: "bridge" },
  { id: "instrumental", name: "Instrumental", color: "#6b7280", shortcut: "", typeKey: "instrumental" },
  { id: "tag", name: "Tag", color: "#ec4899", shortcut: "T", typeKey: "tag" },
  { id: "outro", name: "Final", color: "#f97316", shortcut: "F", typeKey: "outro" },
  { id: "ending", name: "Encerramento", color: "#eab308", shortcut: "E", typeKey: "ending" },
];

const SONG_GROUPS_STORAGE_KEY = "open_presenter_song_groups";

function loadStoredGroups(): SongGroupConfig[] {
  try {
    const raw = localStorage.getItem(SONG_GROUPS_STORAGE_KEY);
    if (!raw) return DEFAULT_SONG_GROUPS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SONG_GROUPS;
  } catch {
    return DEFAULT_SONG_GROUPS;
  }
}

function persistGroups(groups: SongGroupConfig[]): void {
  try {
    localStorage.setItem(SONG_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch {}
}

interface SongGroupsState {
  groups: SongGroupConfig[];
  load(): void;
  updateGroup(id: string, partial: Partial<SongGroupConfig>): void;
  addGroup(name?: string, color?: string, shortcut?: string): void;
  removeGroup(id: string): void;
  moveGroup(id: string, direction: -1 | 1): void;
  setShortcut(id: string, shortcut: string): void;
  clearShortcut(id: string): void;
  resetDefaults(): void;
  getGroupForSection(sectionType: string | null | undefined, label: string | null | undefined): SongGroupConfig | undefined;
}

export const useSongGroupsStore = create<SongGroupsState>((set, get) => ({
  groups: loadStoredGroups(),

  load: () => {
    set({ groups: loadStoredGroups() });
  },

  updateGroup: (id, partial) => {
    const groups = get().groups.map((g) => (g.id === id ? { ...g, ...partial } : g));
    persistGroups(groups);
    set({ groups });
  },

  addGroup: (name = "Novo grupo", color = "#3b82f6", shortcut = "") => {
    const newGroup: SongGroupConfig = {
      id: crypto.randomUUID(),
      name,
      color,
      shortcut: shortcut.toUpperCase(),
    };
    const groups = [...get().groups, newGroup];
    persistGroups(groups);
    set({ groups });
  },

  removeGroup: (id) => {
    const groups = get().groups.filter((g) => g.id !== id);
    persistGroups(groups);
    set({ groups });
  },

  moveGroup: (id, direction) => {
    const groups = [...get().groups];
    const idx = groups.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= groups.length) return;

    const [item] = groups.splice(idx, 1);
    groups.splice(targetIdx, 0, item);
    persistGroups(groups);
    set({ groups });
  },

  setShortcut: (id, shortcut) => {
    const cleanKey = shortcut.trim().toUpperCase().slice(0, 3);
    const groups = get().groups.map((g) => (g.id === id ? { ...g, shortcut: cleanKey } : g));
    persistGroups(groups);
    set({ groups });
  },

  clearShortcut: (id) => {
    const groups = get().groups.map((g) => (g.id === id ? { ...g, shortcut: "" } : g));
    persistGroups(groups);
    set({ groups });
  },

  resetDefaults: () => {
    persistGroups(DEFAULT_SONG_GROUPS);
    set({ groups: DEFAULT_SONG_GROUPS });
  },

  getGroupForSection: (sectionType, label) => {
    const groups = get().groups;
    if (sectionType) {
      const matchType = groups.find((g) => g.typeKey === sectionType);
      if (matchType) return matchType;
    }
    if (label) {
      const normLabel = label.toLowerCase();
      const matchName = groups.find(
        (g) =>
          normLabel.includes(g.name.toLowerCase()) ||
          g.name.toLowerCase().includes(normLabel.replace(/\s*\d+$/, "")),
      );
      if (matchName) return matchName;
    }
    return undefined;
  },
}));
