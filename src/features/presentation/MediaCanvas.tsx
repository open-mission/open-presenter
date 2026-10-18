import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { MediaItem } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { FIT_CLASSES, resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import { useMediaBaseUrl } from "./useMediaBaseUrl";

function VideoMedia({
  url,
  fit,
  interactive,
  muted,
}: {
  url: string;
  fit: MediaItem["fit"];
  interactive: boolean;
  muted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsGesture(false);
    const attempt = video.play();
    if (attempt) {
      void attempt.catch(() => setNeedsGesture(true));
    }
  }, [url]);

  async function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsGesture(false);
    } catch {
      setNeedsGesture(true);
    }
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={url}
        playsInline
        muted={muted}
        controls={interactive}
        preload="auto"
        className={cn(
          "absolute inset-0 h-full w-full",
          FIT_CLASSES[fit ?? "contain"],
        )}
      />
      {needsGesture && !interactive && (
        <button
          type="button"
          onClick={() => void handlePlay()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white cursor-pointer"
          title="Reproduzir vídeo"
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-white/15 border border-white/30 backdrop-blur-sm">
            <Play className="size-10 fill-current" />
          </span>
          <span className="text-sm font-semibold tracking-wide">
            Clique para reproduzir
          </span>
        </button>
      )}
    </div>
  );
}

export function MediaCanvas({
  media,
  interactive = false,
}: {
  media: MediaItem;
  interactive?: boolean;
}) {
  const base = useMediaBaseUrl();
  const fit = media.fit ?? "contain";
  const isPublicOutput =
    typeof window !== "undefined" &&
    window.location.hash.startsWith("#/public");

  if (!media.path) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black p-8 text-center">
        <div className="max-w-xl">
          <p className="text-3xl font-bold text-white">{media.title}</p>
          {media.text && (
            <p className="mt-4 whitespace-pre-line text-xl leading-relaxed text-white/80">
              {media.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  const url = resolveMediaLibraryUrl(media.path, base);

  if (media.kind === "video") {
    return (
      <VideoMedia
        url={url}
        fit={media.fit}
        interactive={interactive}
        muted={!isPublicOutput}
      />
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <img
        src={url}
        alt={media.title}
        draggable={false}
        className={cn(
          "absolute inset-0 h-full w-full select-none",
          FIT_CLASSES[fit],
        )}
      />
    </div>
  );
}
