import { create } from "zustand";
import { isTauri } from "@/core/ipc/tauri";
import { emit } from "@tauri-apps/api/event";
import { syncBus } from "@/core/sync/syncBus";

export interface MediaInfo {
  source: string;
  title: string;
  kind?: "video" | "audio";
}

export interface MediaPlaybackSyncPayload {
  active: boolean;
  source: string | null;
  title: string | null;
  kind: "video" | "audio";
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoop: boolean;
  isMuted: boolean;
  volume: number;
  seekTarget: number | null;
  commandNonce: number;
}

const TAURI_MEDIA_EVENT = "media://playback";

interface MediaPlaybackState {
  active: boolean;
  source: string | null;
  title: string | null;
  kind: "video" | "audio";
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoop: boolean;
  isMuted: boolean;
  volume: number;
  seekTarget: number | null;
  commandNonce: number;

  setMedia: (media: MediaInfo | null) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setLoop: (loop: boolean) => void;
  toggleLoop: () => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  updateProgress: (currentTime: number, duration?: number) => void;
  restart: () => void;
  stop: () => void;
}

function broadcastPlayback(state: MediaPlaybackState) {
  const payload: MediaPlaybackSyncPayload = {
    active: state.active,
    source: state.source,
    title: state.title,
    kind: state.kind,
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    duration: state.duration,
    isLoop: state.isLoop,
    isMuted: state.isMuted,
    volume: state.volume,
    seekTarget: state.seekTarget,
    commandNonce: state.commandNonce,
  };

  if (isTauri()) {
    void emit(TAURI_MEDIA_EVENT, payload).catch(() => {});
  }
  syncBus.publish(TAURI_MEDIA_EVENT, payload);
}

export const useMediaPlaybackStore = create<MediaPlaybackState>((set, get) => ({
  active: false,
  source: null,
  title: null,
  kind: "video",
  isPlaying: true,
  currentTime: 0,
  duration: 0,
  isLoop: true,
  isMuted: true,
  volume: 1,
  seekTarget: null,
  commandNonce: 0,

  setMedia: (media) => {
    if (!media) {
      set({
        active: false,
        source: null,
        title: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        seekTarget: null,
      });
      return;
    }
    const isNew = get().source !== media.source;
    set((s) => ({
      active: true,
      source: media.source,
      title: media.title,
      kind: media.kind ?? "video",
      isPlaying: true,
      currentTime: isNew ? 0 : s.currentTime,
      seekTarget: isNew ? 0 : null,
      commandNonce: s.commandNonce + 1,
    }));
    broadcastPlayback(get());
  },

  play: () => {
    set((s) => ({ isPlaying: true, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  pause: () => {
    set((s) => ({ isPlaying: false, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  togglePlay: () => {
    const next = !get().isPlaying;
    set((s) => ({ isPlaying: next, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  seek: (time: number) => {
    const bounded = Math.max(0, Math.min(get().duration || 999999, time));
    set((s) => ({
      currentTime: bounded,
      seekTarget: bounded,
      commandNonce: s.commandNonce + 1,
    }));
    broadcastPlayback(get());
  },

  setLoop: (isLoop: boolean) => {
    set((s) => ({ isLoop, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  toggleLoop: () => {
    set((s) => ({ isLoop: !s.isLoop, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  setMuted: (isMuted: boolean) => {
    set((s) => ({ isMuted, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted, commandNonce: s.commandNonce + 1 }));
    broadcastPlayback(get());
  },

  setVolume: (volume: number) => {
    const bounded = Math.max(0, Math.min(1, volume));
    set((s) => ({
      volume: bounded,
      isMuted: bounded === 0 ? true : s.isMuted,
      commandNonce: s.commandNonce + 1,
    }));
    broadcastPlayback(get());
  },

  updateProgress: (currentTime: number, duration?: number) => {
    set((s) => ({
      currentTime,
      duration: duration !== undefined && duration > 0 ? duration : s.duration,
      // Clear seekTarget if reached
      seekTarget: s.seekTarget !== null && Math.abs(currentTime - s.seekTarget) < 0.5 ? null : s.seekTarget,
    }));
  },

  restart: () => {
    set((s) => ({
      currentTime: 0,
      seekTarget: 0,
      isPlaying: true,
      commandNonce: s.commandNonce + 1,
    }));
    broadcastPlayback(get());
  },

  stop: () => {
    set((s) => ({
      isPlaying: false,
      currentTime: 0,
      seekTarget: 0,
      commandNonce: s.commandNonce + 1,
    }));
    broadcastPlayback(get());
  },
}));
