import { TAURI_EVENTS, outputWsUrl } from "../config/app";
import { isTauri, listenCommand } from "../ipc/tauri";

export type SyncHandler<T> = (payload: T) => void;

type UnknownHandler = (payload: unknown) => void;

interface SyncBus {
  init(): Promise<void>;
  subscribe<T>(channel: string, handler: SyncHandler<T>): () => void;
  publish<T>(channel: string, payload: T): void;
}

function createSyncBus(): SyncBus {
  const handlers = new Map<string, Set<UnknownHandler>>();
  let socket: WebSocket | null = null;
  let initialized = false;

  function dispatch(channel: string, payload: unknown): void {
    const set = handlers.get(channel);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  async function init(): Promise<void> {
    if (initialized) return;
    initialized = true;

    if (isTauri()) {
      await listenCommand<unknown>(TAURI_EVENTS.slide, (payload) =>
        dispatch(TAURI_EVENTS.slide, payload),
      );
      await listenCommand<unknown>(TAURI_EVENTS.stageMessage, (payload) =>
        dispatch(TAURI_EVENTS.stageMessage, payload),
      );
      await listenCommand<unknown>(TAURI_EVENTS.themes, (payload) =>
        dispatch(TAURI_EVENTS.themes, payload),
      );
      return;
    }

    const host = window.location.hostname || "localhost";
    socket = new WebSocket(outputWsUrl(host));
    socket.addEventListener("message", (event) => {
      try {
        const envelope = JSON.parse(String(event.data)) as {
          channel?: unknown;
          payload?: unknown;
        };
        if (envelope && typeof envelope.channel === "string") {
          dispatch(envelope.channel, envelope.payload);
        }
      } catch {
        return;
      }
    });
  }

  function subscribe<T>(channel: string, handler: SyncHandler<T>): () => void {
    let set = handlers.get(channel);
    if (!set) {
      set = new Set();
      handlers.set(channel, set);
    }
    const wrapped = handler as unknown as UnknownHandler;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  function publish<T>(channel: string, payload: T): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ channel, payload, version: 1 }));
    }
  }

  return { init, subscribe, publish };
}

export const syncBus = createSyncBus();
