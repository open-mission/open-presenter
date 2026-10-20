import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import type { SectionType, SongGroupConfig } from "@/core/types";

export type { SongGroupConfig };

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

export const SONG_GROUPS_STORAGE_KEY = "open_presenter_song_groups";
export const SONG_GROUPS_EVENT = "song-groups-changed";

const BROADCAST_CHANNEL = "open_presenter_song_groups";

function normalizeShortcut(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toUpperCase().slice(0, 3)
    : "";
}

function normalizeGroups(value: unknown): SongGroupConfig[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const groups: SongGroupConfig[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id) continue;
    groups.push({
      id: item.id,
      name: typeof item.name === "string" && item.name ? item.name : "Grupo",
      color: typeof item.color === "string" && item.color ? item.color : "#3b82f6",
      shortcut: normalizeShortcut(item.shortcut),
      ...(typeof item.typeKey === "string"
        ? { typeKey: item.typeKey as SectionType }
        : {}),
    });
  }
  return groups.length > 0 ? groups : null;
}

function loadStoredGroups(): SongGroupConfig[] {
  try {
    const raw = localStorage.getItem(SONG_GROUPS_STORAGE_KEY);
    if (!raw) return DEFAULT_SONG_GROUPS;
    const parsed = normalizeGroups(JSON.parse(raw));
    return parsed ?? DEFAULT_SONG_GROUPS;
  } catch {
    return DEFAULT_SONG_GROUPS;
  }
}

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
    } catch {
      channel = null;
    }
  }
  return channel;
}

function writeStoredGroups(groups: SongGroupConfig[]): void {
  try {
    localStorage.setItem(SONG_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch {}
}

function notifyOtherWindows(groups: SongGroupConfig[]): void {
  try {
    getChannel()?.postMessage(groups);
  } catch {}
  if (isTauri()) {
    void emit(SONG_GROUPS_EVENT, groups).catch(() => {});
  }
}

function persistGroups(groups: SongGroupConfig[]): void {
  writeStoredGroups(groups);
  notifyOtherWindows(groups);
}

/** Aplica grupos recebidos de outra janela sem reemitir o evento. */
function applyExternalGroups(value: unknown): void {
  const groups = normalizeGroups(value);
  if (!groups) return;
  writeStoredGroups(groups);
  useSongGroupsStore.setState({ groups });
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
}

export const useSongGroupsStore = create<SongGroupsState>((set, get) => ({
  groups: loadStoredGroups(),

  load: () => {
    set({ groups: loadStoredGroups() });
  },

  updateGroup: (id, partial) => {
    const groups = get().groups.map((g) =>
      g.id === id
        ? {
            ...g,
            ...partial,
            shortcut:
              partial.shortcut !== undefined
                ? normalizeShortcut(partial.shortcut)
                : g.shortcut,
          }
        : g,
    );
    persistGroups(groups);
    set({ groups });
  },

  addGroup: (name = "Novo grupo", color = "#3b82f6", shortcut = "") => {
    const newGroup: SongGroupConfig = {
      id: crypto.randomUUID(),
      name,
      color,
      shortcut: normalizeShortcut(shortcut),
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
    const cleanKey = normalizeShortcut(shortcut);
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
}));

/**
 * Mantém os grupos sincronizados entre a janela principal e a janela de
 * Preferências. As duas rodam em contextos JS separados; sem isso, mudar um
 * atalho nas Preferências não atualiza os rótulos da letra até reiniciar.
 */
export function initSongGroupsSync(): () => void {
  if (typeof window === "undefined") return () => {};

  let disposed = false;

  const reloadFromStorage = () => {
    if (disposed) return;
    useSongGroupsStore.setState({ groups: loadStoredGroups() });
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SONG_GROUPS_STORAGE_KEY) reloadFromStorage();
  };

  const handleChannelMessage = (event: MessageEvent) => {
    if (!disposed) applyExternalGroups(event.data);
  };

  window.addEventListener("storage", handleStorage);
  getChannel()?.addEventListener("message", handleChannelMessage);

  let unlisten: (() => void) | null = null;
  void listenCommand<SongGroupConfig[]>(SONG_GROUPS_EVENT, (groups) => {
    if (!disposed) applyExternalGroups(groups);
  }).then((fn) => {
    if (!fn) return;
    if (disposed) fn();
    else unlisten = fn;
  });

  return () => {
    disposed = true;
    window.removeEventListener("storage", handleStorage);
    getChannel()?.removeEventListener("message", handleChannelMessage);
    unlisten?.();
  };
}
