import { useEffect } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { StageAlerts } from "@/features/stage-display/StageAlerts";
import { StageClock } from "@/features/stage-display/StageClock";
import { useStageConfigStore } from "@/features/stage-display/configStore";
import { useStageTimerSync } from "@/features/stage-display/useStageTimerSync";
import { themeBackgroundStyle } from "@/features/slide-themes/ThemeRenderer";
import { useLiveThemesStore } from "@/features/slide-themes/liveThemesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";

export default function StageView() {
  usePresentationSync("stage");
  useStageTimerSync();
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);
  const { fontSize, theme, showNextUp } = useStageConfigStore();
  const loadThemes = useSlideThemesStore((s) => s.load);
  const broadcastTheme = useLiveThemesStore((s) => s.themes.stage);
  const localStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  // O palco sempre mostra o retorno (relógio, letra, próxima estrofe).
  // O tema do palco entra apenas como plano de fundo, separado do telão.
  const stageTheme = broadcastTheme ?? localStageTheme;
  const backgroundStyle = stageTheme ? themeBackgroundStyle(stageTheme) : {};

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

  return (
    <div className={`relative flex min-h-full flex-col justify-between p-8 text-center ${themeClass}`} style={backgroundStyle}>
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
