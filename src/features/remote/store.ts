import { create } from "zustand";
import {
  getRemoteConfig,
  setRemoteEnabled,
  setRemoteToken,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import type { RemoteConfig } from "@/core/types";

interface RemoteState {
  isOpen: boolean;
  config: RemoteConfig | null;
  loading: boolean;
  error: string | null;
  openDialog(): void;
  closeDialog(): void;
  ensureToken(): Promise<RemoteConfig | null>;
  regenerateToken(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createRemoteToken(): string {
  const gCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (gCrypto && typeof gCrypto.randomUUID === "function") {
    return gCrypto.randomUUID().replace(/-/g, "");
  }
  if (gCrypto && typeof gCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(24);
    gCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}

let ensureInFlight: Promise<RemoteConfig | null> | null = null;

export const useRemoteStore = create<RemoteState>((set, get) => ({
  isOpen: false,
  config: null,
  loading: false,
  error: null,

  openDialog: () => {
    set({ isOpen: true });
    void get().ensureToken();
  },

  closeDialog: () => set({ isOpen: false }),

  ensureToken: async () => {
    if (!isTauri()) {
      set({ error: "O controle remoto está disponível no app desktop." });
      return null;
    }
    if (ensureInFlight) return ensureInFlight;

    ensureInFlight = (async () => {
      set({ loading: true, error: null });
      try {
        let config = await getRemoteConfig();
        if (!config.token) {
          config = await setRemoteToken(createRemoteToken());
        }
        set({ config, loading: false, error: null });
        return config;
      } catch (err) {
        set({ loading: false, error: errorMessage(err) });
        return null;
      } finally {
        ensureInFlight = null;
      }
    })();

    return ensureInFlight;
  },

  regenerateToken: async () => {
    if (!isTauri()) return false;
    set({ loading: true, error: null });
    try {
      const config = await setRemoteToken(createRemoteToken());
      set({ config, loading: false, error: null });
      return true;
    } catch (err) {
      set({ loading: false, error: errorMessage(err) });
      return false;
    }
  },

  setEnabled: async (enabled) => {
    if (!isTauri()) return;
    set({ error: null });
    try {
      const config = await setRemoteEnabled(enabled);
      set({ config });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },
}));
