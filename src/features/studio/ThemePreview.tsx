import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { SlideTheme, ThemeAsset } from "@/core/types";
import { previewTheme } from "@/features/slide-themes/pages";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";

interface ThemePreviewProps {
  theme: SlideTheme;
  asset: ThemeAsset;
  title: string;
  className?: string;
}

export const ThemePreview = memo(function ThemePreview({
  theme,
  asset,
  title,
  className = "absolute inset-0",
}: ThemePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const preview = useMemo(() => previewTheme(theme, asset), [theme, asset]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "200px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const props = useMemo(
    () => ({
      title,
      titulo: title,
      lyrics: title,
      letra: title,
      text: title,
      texto: title,
    }),
    [title],
  );

  return (
    <div ref={hostRef} className={className}>
      {visible ? (
        <ScaledStage theme={preview.theme} asset={preview.asset} props={props} />
      ) : (
        <div className="size-full bg-black" />
      )}
    </div>
  );
});