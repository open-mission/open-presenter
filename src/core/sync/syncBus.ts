import { TAURI_EVENTS, WS_PATH } from "../config/app";
import { isTauri, listenCommand } from "../ipc/tauri";

export const CLIENT_HELLO = "client://hello";

export type SyncOutput = "public" | "stage" | "stream" | "admin";

export type SyncHandler<T> = (payload: T) => void;

type UnknownHandler = (payload: unknown) => void;

interface SyncBus {
  init(output?: SyncOutput): Promise<void>;
  subscribe<T>(channel: string, handler: SyncHandler<T>): () => void;
  publish<T>(channel: string, payload: T): void;
}

function createSyncBus(): SyncBus {
  const handlers = new Map<string, Set<UnknownHandler>>();
  let socket: WebSocket | null = null;
  let initialized = false;
  let helloOutput: SyncOutput | null = null;

  function dispatch(channel: string, payload: unknown): void {
    const set = handlers.get(channel);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  function announce(): void {
    if (!helloOutput || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        channel: CLIENT_HELLO,
        payload: { output: helloOutput },
        version: 1,
      }),
    );
  }

  async function init(output?: SyncOutput): Promise<void> {
    if (output) helloOutput = output;
    if (initialized) {
      announce();
      return;
    }
    initialized = true;

    if (isTauri()) {
      await listenCommand<unknown>(TAURI_EVENTS.slide, (payload) =>
        dispatch(TAURI_EVENTS.slide, payload),
      );
      await listenCommand<unknown>(TAURI_EVENTS.stageMessage, (payload) =>
        dispatch(TAURI_EVENTS.stageMessage, payload),
      );
      await listenCommand<unknown>(TAURI_EVENTS.timer, (payload) =>
        dispatch(TAURI_EVENTS.timer, payload),
      );
      await listenCommand<unknown>(TAURI_EVENTS.wallpaper, (payload) =>
        dispatch(TAURI_EVENTS.wallpaper, payload),
      );
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${proto}://${window.location.host}${WS_PATH}`);
    socket.addEventListener("open", announce);
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
