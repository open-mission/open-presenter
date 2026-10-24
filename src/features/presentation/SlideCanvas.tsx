import type { LiveSlide } from "@/core/types";
import { cleanPublicLines } from "@/core/lib/lyrics";
import { cn } from "@/core/lib/utils";
import { BackgroundRenderer } from "../media-shaders/BackgroundRenderer";
import { MediaCanvas } from "./MediaCanvas";

export function SlideCanvas({
  slide,
  lineClassName,
  showTitle = false,
  showBackground = true,
  hideText = false,
  isFirstFrameOnly = false,
}: {
  slide: LiveSlide;
  lineClassName?: string;
  showTitle?: boolean;
  showBackground?: boolean;
  hideText?: boolean;
  isFirstFrameOnly?: boolean;
}) {
  if (slide.blackout) {
    return <div className="h-full w-full bg-black" />;
  }

  if (slide.content.kind === "media" && slide.content.media) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        {!slide.cleared && <MediaCanvas media={slide.content.media} />}
      </div>
    );
  }

  // Omit song title and section on public lyrics projection (only show reference for scriptures or explicit showTitle)
  const isScripture = slide.content.kind === "scripture";
  const shouldRenderTitle = (showTitle || isScripture) && slide.content.title.trim().length > 0;
  const linesToRender =
    slide.content.kind === "lyric"
      ? cleanPublicLines(slide.content.lines)
      : slide.content.lines;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden [container-type:inline-size]",
        showBackground ? "bg-black" : "bg-transparent",
      )}
    >
      {showBackground && (
        <BackgroundRenderer
          background={slide.background}
          isFirstFrameOnly={isFirstFrameOnly}
        />
      )}
      {!slide.cleared && !hideText && slide.content.kind !== "blank" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-[4cqw] text-center">
          {shouldRenderTitle && (
            <p className="text-[2.2cqw] font-semibold uppercase tracking-[0.25em] text-white/70 mb-[1.5cqw]">
              {slide.content.title}
              {slide.content.section ? ` · ${slide.content.section}` : ""}
            </p>
          )}

          <div className="flex flex-col items-center justify-center gap-[1.2cqw] max-w-[92%]">
            {linesToRender.map((line, idx) => (
              <p
                key={`${idx}-${line}`}
                className={cn(
                  "text-[4.6cqw] font-bold leading-[1.24] text-white [text-shadow:0_0.25cqw_2.5cqw_rgba(0,0,0,0.95)]",
                  lineClassName,
                )}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
