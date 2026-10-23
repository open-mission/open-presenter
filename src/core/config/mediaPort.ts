import { useEffect, useSyncExternalStore } from "react";
import { getServerStatus } from "@/core/ipc/commands";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import { OUTPUT_HTTP_PORT, TAURI_EVENTS } from "./app";

let mediaPort: number | null = null;
let mediaServerRunning: boolean | null = null;
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

/**
 * Registra o estado do servidor de mídia. Quando `running` é `false`, os
 * resolvedores usam o protocolo customizado `media://` em vez de apontar
 * para um servidor HTTP que não está escutando.
 */
export function setMediaServer(port: number | null, running: boolean | null): void {
  setMediaPort(port);
  if (mediaServerRunning === running) return;
  mediaServerRunning = running;
  notify();
}

export function getMediaPort(): number | null {
  return mediaPort;
}

export function isMediaServerRunning(): boolean | null {
  return mediaServerRunning;
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
 * é buscada via IPC e revalidada sempre que o estado das saídas muda (o
 * servidor pode subir, parar ou trocar de porta depois do boot).
 */
export function useMediaPortSync(): void {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    async function refresh(): Promise<void> {
      const status = await getServerStatus();
      if (disposed) return;
      setMediaServer(status?.port ?? null, status?.running ?? null);
    }

    if (isTauri()) {
      void refresh();
      void listenCommand(TAURI_EVENTS.outputs, () => {
        void refresh();
      }).then((fn) => {
        if (disposed) fn?.();
        else unlisten = fn;
      });
    } else if (typeof window !== "undefined" && window.location.port) {
      const port = Number(window.location.port);
      if (port > 0) setMediaServer(port, true);
    }

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
