import { useEffect, useRef } from "react";
import { useMediaPlaybackStore } from "@/core/store/mediaPlaybackStore";
import { useAudioSettingsStore } from "@/core/store/audioSettingsStore";

export function BackgroundAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const active = useMediaPlaybackStore((s) => s.active);
  const source = useMediaPlaybackStore((s) => s.source);
  const kind = useMediaPlaybackStore((s) => s.kind);
  const isPlaying = useMediaPlaybackStore((s) => s.isPlaying);
  const isLoop = useMediaPlaybackStore((s) => s.isLoop);
  const isMuted = useMediaPlaybackStore((s) => s.isMuted);
  const volume = useMediaPlaybackStore((s) => s.volume);
  const seekTarget = useMediaPlaybackStore((s) => s.seekTarget);
  const commandNonce = useMediaPlaybackStore((s) => s.commandNonce);

  const selectedDeviceId = useAudioSettingsStore((s) => s.selectedDeviceId);
  const masterVolume = useAudioSettingsStore((s) => s.masterVolume);

  const isAudioActive = active && kind === "audio" && Boolean(source);

  // Configure output device via setSinkId if supported
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if ("setSinkId" in el && typeof (el as { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
      (el as unknown as { setSinkId: (id: string) => Promise<void> })
        .setSinkId(selectedDeviceId || "")
        .catch(() => {});
    }
  }, [selectedDeviceId]);

  // Volume & loop synchronization
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.loop = isLoop;
    el.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume * masterVolume));
  }, [isLoop, isMuted, volume, masterVolume]);

  // Source loading & play / pause control
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!isAudioActive || !source) {
      el.pause();
      if (el.src) {
        el.removeAttribute("src");
        el.load();
      }
      return;
    }

    if (el.src !== source) {
      el.src = source;
      el.load();
    }

    if (isPlaying) {
      const p = el.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    } else {
      el.pause();
    }
  }, [isAudioActive, source, isPlaying]);

  // Handle seeks
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !isAudioActive || seekTarget === null) return;
    try {
      el.currentTime = seekTarget;
    } catch {
      // ignore
    }
  }, [isAudioActive, seekTarget, commandNonce]);

  // Event handlers
  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !isAudioActive) return;
    useMediaPlaybackStore
      .getState()
      .updateProgress(el.currentTime, isNaN(el.duration) ? 0 : el.duration);
  };

  const handleEnded = () => {
    if (!isLoop) {
      useMediaPlaybackStore.getState().pause();
    }
  };

  return (
    <audio
      ref={audioRef}
      className="hidden"
      preload="auto"
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  );
}
