import { useEffect, useRef, useState } from "react";
import type { BackgroundLayer } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { isCssGradient } from "@/core/lib/cssValue";
import { useMediaPort } from "@/core/config/mediaPort";
import { isTauri } from "@/core/ipc/tauri";
import { useMediaPlaybackStore } from "@/core/store/mediaPlaybackStore";
import {
  resolveThemeMediaUrl,
  resolveCssMediaUrls,
  parseMediaWithFit,
  FIT_CLASSES,
} from "@/features/theme-editor/media";
import { ShaderCanvas } from "./ShaderCanvas";

function extractFilename(urlOrPath: string): string {
  try {
    const clean = urlOrPath.split("?")[0].split("#")[0];
    const parts = clean.split(/[/\\]/);
    const last = parts[parts.length - 1];
    return decodeURIComponent(last || "Vídeo");
  } catch {
    return "Vídeo";
  }
}

/**
 * URL alternativa pelo protocolo customizado `media://`. Usada quando o HTTP
 * local falha (servidor fora do ar, porta bloqueada etc.) em janelas nativas.
 */
function mediaProtocolFallback(value: string): string | null {
  return isTauri() && value.trim().startsWith("media://") ? value.trim() : null;
}

function MediaSource({
  kind,
  src,
  fallbackSrc,
  className,
  isFirstFrameOnly = false,
}: {
  kind: "image" | "video";
  src: string;
  fallbackSrc: string | null;
  className: string;
  isFirstFrameOnly?: boolean;
}) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setCurrent(src);
    setFailed(false);
  }, [src]);

  // Se não for prévia estática, conecta o vídeo aos controles globais de reprodução do header
  useEffect(() => {
    if (kind !== "video" || isFirstFrameOnly) return;

    const mediaTitle = extractFilename(current);
    useMediaPlaybackStore.getState().setMedia({
      source: current,
      title: mediaTitle,
      kind: "video",
    });

    const unsub = useMediaPlaybackStore.subscribe((state, prev) => {
      const vid = videoRef.current;
      if (!vid) return;

      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) {
          void vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      }

      if (state.seekTarget !== null && state.seekTarget !== prev.seekTarget) {
        vid.currentTime = state.seekTarget;
      }

      if (state.isLoop !== prev.isLoop) {
        vid.loop = state.isLoop;
      }

      if (state.isMuted !== prev.isMuted) {
        vid.muted = state.isMuted;
      }

      if (state.volume !== prev.volume) {
        vid.volume = state.volume;
      }
    });

    return () => {
      unsub();
    };
  }, [kind, current, isFirstFrameOnly]);

  const handleError = () => {
    if (fallbackSrc && current !== fallbackSrc) {
      console.warn(
        `[media] falha ao carregar "${current}"; tentando "${fallbackSrc}"`,
      );
      setCurrent(fallbackSrc);
    } else {
      console.warn(`[media] imagem/vídeo inacessível: "${current}"`);
      setFailed(true);
    }
  };

  if (failed) {
    return <div className={cn("bg-black/80", className)} />;
  }

  if (kind === "video") {
    if (isFirstFrameOnly) {
      // Exibe apenas o primeiro frame estático (usado no preview)
      return (
        <video
          key={`frame-${current}`}
          src={current.includes("#t=") ? current : `${current}#t=0.001`}
          preload="auto"
          muted
          playsInline
          className={className}
          onError={handleError}
          onLoadedData={(e) => {
            e.currentTarget.currentTime = 0.001;
            e.currentTarget.pause();
          }}
        />
      );
    }

    const { isPlaying, isLoop, isMuted, volume } = useMediaPlaybackStore.getState();

    return (
      <video
        ref={videoRef}
        src={current}
        autoPlay={isPlaying}
        muted={isMuted}
        loop={isLoop}
        playsInline
        className={className}
        onError={handleError}
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          vid.volume = volume;
          vid.muted = isMuted;
          vid.loop = isLoop;
          if (isPlaying) {
            void vid.play().catch(() => {});
          } else {
            vid.pause();
          }
          useMediaPlaybackStore.getState().updateProgress(vid.currentTime, vid.duration);
        }}
        onTimeUpdate={(e) => {
          const vid = e.currentTarget;
          useMediaPlaybackStore.getState().updateProgress(vid.currentTime, vid.duration);
        }}
      />
    );
  }

  return (
    <img src={current} alt="" className={className} onError={handleError} />
  );
}

export function BackgroundRenderer({
  background,
  className,
  isFirstFrameOnly = false,
}: {
  background: BackgroundLayer;
  className?: string;
  isFirstFrameOnly?: boolean;
}) {
  const mediaPort = useMediaPort();
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const port = mediaPort ?? undefined;

  if (background.kind === "image") {
    const { url, fit } = parseMediaWithFit(background.value);
    if (isCssGradient(url)) {
      const resolved = resolveCssMediaUrls(url, host, port) ?? url;
      return (
        <div
          className={cn("absolute inset-0", className)}
          style={{ background: resolved }}
        />
      );
    }
    const resolved = resolveThemeMediaUrl(url, host, port) ?? url;
    if (!resolved) return null;
    return (
      <MediaSource
        kind="image"
        src={resolved}
        fallbackSrc={mediaProtocolFallback(background.value)}
        className={cn("absolute inset-0 h-full w-full", FIT_CLASSES[fit], className)}
      />
    );
  }

  if (background.kind === "video") {
    const { url, fit } = parseMediaWithFit(background.value);
    const resolved = resolveThemeMediaUrl(url, host, port) ?? url;
    if (!resolved) return null;
    return (
      <MediaSource
        kind="video"
        src={resolved}
        fallbackSrc={mediaProtocolFallback(background.value)}
        className={cn("absolute inset-0 h-full w-full", FIT_CLASSES[fit], className)}
        isFirstFrameOnly={isFirstFrameOnly}
      />
    );
  }

  if (background.kind === "css") {
    if (
      background.value.startsWith("isf:") ||
      (background.value.includes("/*{") && background.value.includes("void main"))
    ) {
      return (
        <div className={cn("absolute inset-0 overflow-hidden", className)}>
          <ShaderCanvas shader={background.value} />
        </div>
      );
    }
    const resolved = resolveCssMediaUrls(background.value, host, port) ?? background.value;
    return (
      <div
        className={cn("absolute inset-0", className)}
        style={{ background: resolved }}
      />
    );
  }

  if (background.kind === "isf") {
    return (
      <div className={cn("absolute inset-0 overflow-hidden", className)}>
        <ShaderCanvas shader={background.value} />
      </div>
    );
  }

  return (
    <div
      className={cn("absolute inset-0", className)}
      style={{ backgroundColor: background.value }}
    />
  );
}
