import { useEffect, useState } from "react";
import type { LiveSlide, SlideTheme, ThemeAsset } from "@/core/types";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { SlideCanvas } from "./SlideCanvas";

interface SlideTransitionProps {
  slide: LiveSlide;
  theme: SlideTheme | null;
  asset: ThemeAsset | null;
  cleared: boolean;
  durationMs?: number;
  transitionBackground?: boolean;
}

function RenderSingleSlide({
  slide,
  theme,
  asset,
  showBackground = false,
}: {
  slide: LiveSlide;
  theme: SlideTheme | null;
  asset: ThemeAsset | null;
  showBackground?: boolean;
}) {
  if (theme && asset) {
    return (
      <ScaledStage
        theme={theme}
        asset={asset}
        props={buildProps(slide.content.kind, slide.content, slide.nextUp)}
        showBackground={showBackground}
      />
    );
  }
  return <SlideCanvas slide={slide} showBackground={showBackground} />;
}

export function SlideTransition({
  slide,
  theme,
  asset,
  cleared,
  durationMs = 300,
  transitionBackground = false,
}: SlideTransitionProps) {
  const effectiveAsset =
    asset ?? (slide.content.media?.kind === "text" ? "text" : null);
  const isThemeMode = Boolean(
    theme &&
      effectiveAsset &&
      (slide.content.kind !== "media" || slide.content.media?.kind === "text"),
  );
  const mediaKey =
    slide.content.kind === "media" ? slide.updatedAt : "";
  const currentKey = isThemeMode
    ? `${theme?.guid ?? ""}_${effectiveAsset ?? ""}_${slide.content.kind}`
    : `${slide.content.id}_${slide.content.title}_${slide.content.section ?? ""}_${slide.content.lines.join("\n")}_${theme?.guid ?? ""}_${mediaKey}`;

  const [active, setActive] = useState<{
    key: string;
    slide: LiveSlide;
    theme: SlideTheme | null;
    asset: ThemeAsset | null;
  }>({
    key: currentKey,
    slide,
    theme,
    asset: effectiveAsset,
  });

  const [outgoing, setOutgoing] = useState<{
    key: string;
    slide: LiveSlide;
    theme: SlideTheme | null;
    asset: ThemeAsset | null;
  } | null>(null);

  useEffect(() => {
    if (currentKey !== active.key) {
      setOutgoing(active);
      setActive({ key: currentKey, slide, theme, asset: effectiveAsset });

      const timer = setTimeout(() => {
        setOutgoing(null);
      }, durationMs);

      return () => clearTimeout(timer);
    } else {
      setActive({ key: currentKey, slide, theme, asset: effectiveAsset });
    }
  }, [currentKey, slide, theme, effectiveAsset, durationMs]);

  return (
    <div
      className="relative h-full w-full pointer-events-none select-none transition-opacity ease-in-out"
      style={{
        opacity: cleared ? 0 : 1,
        transitionDuration: `${durationMs}ms`,
      }}
    >
      {outgoing && (
        <div
          key={`out-${outgoing.key}`}
          className="absolute inset-0"
          style={{
            animation: `slideFadeOut ${durationMs}ms ease-in-out forwards`,
          }}
        >
          <RenderSingleSlide
            slide={outgoing.slide}
            theme={outgoing.theme}
            asset={outgoing.asset}
            showBackground={transitionBackground}
          />
        </div>
      )}

      <div
        key={`act-${active.key}`}
        className="absolute inset-0"
        style={
          outgoing
            ? { animation: `slideFadeIn ${durationMs}ms ease-in-out forwards` }
            : undefined
        }
      >
        <RenderSingleSlide
          slide={active.slide}
          theme={active.theme}
          asset={active.asset}
          showBackground={transitionBackground}
        />
      </div>
    </div>
  );
}
