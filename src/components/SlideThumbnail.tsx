import { memo } from "react";
import type { LiveSlide, SlideContent, SlideTheme } from "@/core/types";
import { kindToAsset } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";

export const SlideThumbnail = memo(function SlideThumbnail({
  content,
  theme,
  showBackground = true,
  className,
  textHidden = false,
}: {
  content: SlideContent;
  theme: SlideTheme | null;
  showBackground?: boolean;
  className?: string;
  textHidden?: boolean;
}) {
  const asset = kindToAsset(content.kind);
  const synthetic: LiveSlide = {
    content,
    background: { id: "thumb-bg", kind: "color", value: "#000000" },
    blackout: false,
    cleared: false,
    textHidden,
    updatedAt: "",
  };

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border border-border/70 bg-black shadow-inner",
        className,
      )}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "320px 180px",
      }}
    >
      {theme && asset ? (
        <ScaledStage
          theme={theme}
          asset={asset}
          props={buildProps(content.kind, content, null, {
            hideText: textHidden,
          })}
          showBackground={showBackground}
          disableShader
        />
      ) : (
        <SlideCanvas
          slide={synthetic}
          showBackground={showBackground}
          showTitle={content.kind === "scripture"}
          hideText={textHidden}
        />
      )}
    </div>
  );
});
