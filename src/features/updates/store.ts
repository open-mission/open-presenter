import { create } from "zustand";
import { isTauri } from "@/core/ipc/tauri";
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  type UpdateProgress,
  type UpdateSummary,
} from "./updater";

const AUTO_CHECK_KEY = "open_presenter_auto_update_check";
const SEEN_VERSION_KEY = "open_presenter_seen_version";

export type UpdateStatus =
  | "idle"
  | "unsupported"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "installed"
  | "up-to-date"
  | "error";

function readAutoCheck(): boolean {
  try {
    return localStorage.getItem(AUTO_CHECK_KEY) !== "false";
  } catch {
    return true;
  }
}

export function hasSeenVersion(version: string): boolean {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY) === version;
  } catch {
    return true;
  }
}

export function markVersionSeen(version: string): void {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, version);
  } catch {}
}

interface UpdatesState {
  update: UpdateSummary | null;
  status: UpdateStatus;
  error: string | null;
  progress: UpdateProgress | null;
  dialogOpen: boolean;
  whatsNewOpen: boolean;
  autoCheck: boolean;
  checkNow(options?: { silent?: boolean; openDialog?: boolean }): Promise<void>;
  install(): Promise<void>;
  openDialog(): void;
  closeDialog(): void;
  openWhatsNew(): void;
  closeWhatsNew(): void;
  setAutoCheck(value: boolean): void;
}

export const useUpdatesStore = create<UpdatesState>((set, get) => ({
  update: null,
  status: isTauri() ? "idle" : "unsupported",
  error: null,
  progress: null,
  dialogOpen: false,
  whatsNewOpen: false,
  autoCheck: readAutoCheck(),

  checkNow: async (options) => {
    if (!isTauri()) {
      set({ status: "unsupported", error: null });
      return;
    }

    if (get().status === "checking" || get().status === "downloading") return;

    set({ status: "checking", error: null });
    try {
      const update = await checkForUpdate();
      if (update) {
        set({
          update,
          status: "available",
          error: null,
          dialogOpen: options?.openDialog !== false,
          whatsNewOpen: false,
        });
        return;
      }

      set({ update: null, status: "up-to-date", error: null });
      if (options?.silent) {
        set({ dialogOpen: false });
      }
    } catch (error) {
      set({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível verificar as atualizações.",
      });
    }
  },

  install: async () => {
    if (!isTauri()) {
      set({ status: "unsupported" });
      return;
    }

    set({
      status: "downloading",
      error: null,
      progress: { downloadedBytes: 0, totalBytes: null, percent: 0 },
    });

    try {
      const result = await downloadAndInstallUpdate((progress) => {
        set({ progress, status: "downloading" });
      });
      set({
        status: result.relaunchFailed ? "installed" : "installing",
        progress: null,
      });
    } catch (error) {
      set({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível instalar a atualização.",
      });
    }
  },

  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),
  openWhatsNew: () => set({ whatsNewOpen: true }),
  closeWhatsNew: () => set({ whatsNewOpen: false }),
  setAutoCheck: (value) => {
    try {
      localStorage.setItem(AUTO_CHECK_KEY, String(value));
    } catch {}
    set({ autoCheck: value });
  },
}));
