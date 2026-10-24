import { useEffect } from "react";
import { isTauri } from "@/core/ipc/tauri";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { syncBus } from "@/core/sync/syncBus";
import {
  useMediaPlaybackStore,
  type MediaPlaybackSyncPayload,
} from "@/core/store/mediaPlaybackStore";

const TAURI_MEDIA_EVENT = "media://playback";

export function useMediaPlaybackSync() {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    if (isTauri()) {
      void listen<MediaPlaybackSyncPayload>(TAURI_MEDIA_EVENT, (event) => {
        const payload = event.payload;
        if (!payload) return;
        useMediaPlaybackStore.setState({
          active: payload.active,
          source: payload.source,
          title: payload.title,
          kind: payload.kind,
          isPlaying: payload.isPlaying,
          isLoop: payload.isLoop,
          isMuted: payload.isMuted,
          volume: payload.volume,
          seekTarget: payload.seekTarget,
          commandNonce: payload.commandNonce,
        });
      }).then((fn) => {
        unlisten = fn;
      });
    }

    const unsubWs = syncBus.subscribe<MediaPlaybackSyncPayload>(
      TAURI_MEDIA_EVENT,
      (payload) => {
        if (!payload) return;
        useMediaPlaybackStore.setState({
          active: payload.active,
          source: payload.source,
          title: payload.title,
          kind: payload.kind,
          isPlaying: payload.isPlaying,
          isLoop: payload.isLoop,
          isMuted: payload.isMuted,
          volume: payload.volume,
          seekTarget: payload.seekTarget,
          commandNonce: payload.commandNonce,
        });
      },
    );

    return () => {
      unlisten?.();
      unsubWs();
    };
  }, []);
}
