import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Palette, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStageConfigStore } from "@/features/stage-display/configStore";
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { isStageCandidate, themeCoverageLabel } from "@/features/slide-themes/pages";

export function StageTab() {
  const navigate = useNavigate();

  const {
    clock24h,
    showSeconds,
    nextSlideDisplay,
    countdownMinutes,
    updateConfig,
  } = useStageConfigStore();

  const themes = useSlideThemesStore((s) => s.themes);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
  const setStageTheme = useSlideThemesStore((s) => s.setStageTheme);
  const resolvedStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());

  const stageThemes = useMemo(() => {
    return themes.filter(isStageCandidate);
  }, [themes]);

  return (
    <div className="flex flex-col gap-5">
      {/* Grid: Settings and Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Settings (7 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* Section: Tema do Retorno */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Palette className="size-3.5 text-primary" />
                Tema do Retorno de Palco
              </span>
              {resolvedStageTheme && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
                  onClick={() =>
                    navigate(`/theme-editor?guid=${resolvedStageTheme.guid}`)
                  }
                >
                  <Pencil className="size-3" />
                  Editar no Editor
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={resolvedStageTheme?.guid ?? stageThemeGuid ?? ""}
                onChange={(e) => setStageTheme(e.target.value || null)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {stageThemes.map((t) => (
                  <option key={t.guid} value={t.guid}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {resolvedStageTheme?.pages?.length
                ? `${themeCoverageLabel(resolvedStageTheme)} configurados. O palco troca de página automaticamente conforme o conteúdo (descanso, música, Bíblia ou texto).`
                : "Tema de layout único. Adicione páginas no editor para ter telas diferentes em cada momento."}
            </p>
          </div>

          {/* Section: Widgets de Tempo e Relógio */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              Tempo & Relógio
            </span>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <label className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                <span className="font-medium text-foreground">Formato 24h</span>
                <input
                  type="checkbox"
                  checked={clock24h}
                  onChange={(e) => updateConfig({ clock24h: e.target.checked })}
                  className="size-4 accent-primary rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                <span className="font-medium text-foreground">Exibir Segundos</span>
                <input
                  type="checkbox"
                  checked={showSeconds}
                  onChange={(e) => updateConfig({ showSeconds: e.target.checked })}
                  className="size-4 accent-primary rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Countdown / Timer Duration */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs">
              <div>
                <span className="font-medium text-foreground">
                  Contagem Regressiva (Timer)
                </span>
                <p className="text-[10px] text-muted-foreground">
                  0 = cronômetro progressivo normal
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={countdownMinutes}
                  onChange={(e) =>
                    updateConfig({
                      countdownMinutes: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="h-7 w-16 rounded border border-input bg-background px-2 text-xs text-right font-mono"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
          </div>

          {/* Section: Próximo Slide */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-foreground">
              Exibição do Próximo Slide (Next Up)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => updateConfig({ nextSlideDisplay: "first-line" })}
                className={`flex flex-col rounded-lg border p-2.5 text-left transition-all ${
                  nextSlideDisplay === "first-line"
                    ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                    : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Apenas 1ª Frase</span>
                <span className="text-[10px] font-normal opacity-80">
                  Visão concisa de 1 linha
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ nextSlideDisplay: "full" })}
                className={`flex flex-col rounded-lg border p-2.5 text-left transition-all ${
                  nextSlideDisplay === "full"
                    ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                    : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Slide Inteiro</span>
                <span className="text-[10px] font-normal opacity-80">
                  Todas as linhas do próximo slide
                </span>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Compact Live Preview (5 cols) */}
        <div className="flex flex-col gap-3 lg:col-span-5">
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/60 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Prévia do Palco (16:9)
              </span>
              <Badge variant="outline" className="h-4 text-[9px] font-mono">
                Ao Vivo
              </Badge>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-inner">
              <StageMiniPreview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
