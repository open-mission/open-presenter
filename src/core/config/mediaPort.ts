import { useEffect, useSyncExternalStore } from "react";
import { getServerStatus } from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import { OUTPUT_HTTP_PORT } from "./app";

let mediaPort: number | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function setMediaPort(port: number | null): void {
  const normalized = port && port > 0 ? port : null;
  if (mediaPort === normalized) return;
  mediaPort = normalized;
  notify();
}

export function getMediaPort(): number | null {
  return mediaPort;
}

export function resolveMediaPort(explicit?: number): number {
  if (explicit && explicit > 0) return explicit;
  if (mediaPort && mediaPort > 0) return mediaPort;
  if (
    !isTauri() &&
    typeof window !== "undefined" &&
    window.location.port
  ) {
    const fromLocation = Number(window.location.port);
    if (fromLocation > 0) return fromLocation;
  }
  return OUTPUT_HTTP_PORT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMediaPort(): number | null {
  return useSyncExternalStore(subscribe, getMediaPort, getMediaPort);
}

/**
 * Mantém a porta usada para resolver mídias (`media://`) alinhada ao servidor
 * embutido. Em janelas Tauri a URL não carrega a porta do servidor, então ela
 * é buscada via IPC; no navegador a própria URL já informa a porta.
 */
export function useMediaPortSync(): void {
  useEffect(() => {
    let disposed = false;

    if (isTauri()) {
      void getServerStatus().then((status) => {
        if (!disposed && status?.port) setMediaPort(status.port);
      });
    } else if (typeof window !== "undefined" && window.location.port) {
      const port = Number(window.location.port);
      if (port > 0) setMediaPort(port);
    }

    return () => {
      disposed = true;
    };
  }, []);
}
