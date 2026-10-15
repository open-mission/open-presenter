import type { LiveSlide } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { BackgroundRenderer } from "../media-shaders/BackgroundRenderer";

export function SlideCanvas({
  slide,
  lineClassName,
}: {
  slide: LiveSlide;
  lineClassName?: string;
}) {
  if (slide.blackout || slide.cleared) {
    return <div className="h-full w-full bg-black" />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <BackgroundRenderer background={slide.background} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-[4%] text-center">
        <p className="text-[2vw] font-medium uppercase tracking-[0.3em] text-white/60">
          {slide.content.title}
          {slide.content.section ? ` · ${slide.content.section}` : ""}
        </p>
        {slide.content.lines.map((line) => (
          <p
            key={line}
            className={cn(
              "text-[4.5vw] font-bold leading-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]",
              lineClassName,
            )}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
