import { useEffect } from "react";
import { kindToAsset } from "@/core/types";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { StageAlerts } from "@/features/stage-display/StageAlerts";
import { StageClock } from "@/features/stage-display/StageClock";
import { useStageConfigStore } from "@/features/stage-display/configStore";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";

export default function StageView() {
  usePresentationSync();
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { fontSize, theme, showNextUp } = useStageConfigStore();
  const loadThemes = useSlideThemesStore((s) => s.load);
  const stageTheme = useSlideThemesStore((s) => s.resolveStageTheme());

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  const fontClass =
    fontSize === "normal"
      ? "text-3xl"
      : fontSize === "xlarge"
      ? "text-6xl md:text-7xl font-extrabold"
      : "text-5xl font-bold";

  const themeClass =
    theme === "high-contrast"
      ? "bg-black text-amber-300"
      : theme === "warm"
      ? "bg-stone-950 text-amber-100"
      : "bg-black text-white";

  const asset = kindToAsset(live.content.kind);

  if (stageTheme && asset && !live.blackout && !live.cleared) {
    const props = {
      ...buildProps(live.content.kind, live.content, live.nextUp),
      "HH:MM": new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    return (
      <div className={`relative min-h-full ${themeClass}`}>
        <ScaledStage theme={stageTheme} asset={asset} props={props} />
        <div className="relative z-10 flex min-h-full flex-col p-8">
          <div className="flex justify-center w-full">
            <StageClock />
          </div>

          <StageAlerts />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-full flex-col justify-between p-8 text-center ${themeClass}`}>
      <div className="flex justify-center w-full">
        <StageClock />
      </div>

      <StageAlerts />

      <section className="flex flex-1 flex-col items-center justify-center my-auto py-6 text-center">
        {live.blackout || live.cleared ? (
          <p className={`font-bold opacity-30 text-center ${fontClass}`}>
            {live.blackout ? "Blackout" : "—"}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center max-w-5xl mx-auto w-full">
            {live.content.lines.map((line) => (
              <p key={line} className={`leading-tight text-center ${fontClass}`}>
                {line}
              </p>
            ))}
          </div>
        )}
      </section>

      {showNextUp && nextUp && (
        <section className="border-t border-white/10 pt-4 text-center flex flex-col items-center justify-center">
          <p className="text-xs uppercase tracking-widest opacity-60">
            Próximo · {nextUp.title}
          </p>
          <div className="mt-1 flex flex-col items-center gap-1">
            {nextUp.lines.map((line) => (
              <p key={line} className="text-2xl opacity-80 text-center">
                {line}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
