import { Check, Sparkles } from "lucide-react";
import type { BackgroundLayer } from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { useMediaShadersStore } from "@/features/media-shaders/store";
import { usePresentationStore } from "@/features/presentation/store";

interface ThemeMeta {
  title: string;
  category: string;
  previewStyle: React.CSSProperties;
}

const PRESET_METAS: Record<string, ThemeMeta> = {
  "bg-black": {
    title: "Preto Puro",
    category: "Cor Sólida",
    previewStyle: { backgroundColor: "#000000" },
  },
  "bg-sunset": {
    title: "Pôr do Sol Cósmico",
    category: "Gradiente Radial",
    previewStyle: {
      background:
        "radial-gradient(circle at 50% 120%, #7c2d12 0%, #1c0a00 55%, #000000 100%)",
    },
  },
  "bg-night": {
    title: "Noite Profunda",
    category: "Gradiente Radial",
    previewStyle: {
      background:
        "radial-gradient(circle at 50% 0%, #1e3a8a 0%, #020617 60%, #000000 100%)",
    },
  },
  "bg-isf-demo": {
    title: "Plasma Dinâmico",
    category: "Shader ISF (Animado)",
    previewStyle: {
      background: "linear-gradient(120deg, #0f172a, #4c1d95, #0ea5e9, #0f172a)",
      backgroundSize: "200% 200%",
    },
  },
};

export function ThemesTab() {
  const presets = useMediaShadersStore((s) => s.presets);
  const current = useMediaShadersStore((s) => s.current);
  const setCurrent = useMediaShadersStore((s) => s.setCurrent);
  const setLiveBackground = usePresentationStore((s) => s.setBackground);

  function handleSelectTheme(preset: BackgroundLayer) {
    setCurrent(preset);
    setLiveBackground(preset);
  }

  const currentMeta = PRESET_METAS[current.id] || {
    title: current.id,
    category: current.kind,
    previewStyle:
      current.kind === "color"
        ? { backgroundColor: current.value }
        : current.kind === "css"
          ? { background: current.value }
          : {},
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Temas (Fundos de Projeção)
        </h3>
        <p className="text-sm text-muted-foreground">
          Selecione o plano de fundo padrão aplicado à projeção ao vivo de letras, músicas e bíblia.
        </p>
      </div>

      {/* Live Preview Box with Sample Slide */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Pré-visualização do Tema Ao Vivo
          </span>
          <Badge variant="outline" className="text-[10px] text-primary">
            {currentMeta.title} · {currentMeta.category}
          </Badge>
        </div>

        <div
          className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-border shadow-inner"
          style={currentMeta.previewStyle}
        >
          {current.kind === "isf" && (
            <div className="isf-fallback absolute inset-0 opacity-80" />
          )}
          <div className="relative z-10 max-w-md px-6 text-center text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-300">
              Santo, Santo, Santo
            </p>
            <p className="mt-1 font-bold text-lg leading-snug">
              Deus Todo-Poderoso, digno de louvor
            </p>
          </div>
        </div>
      </div>

      {/* Preset Gallery */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-foreground">
          Galeria de Temas Disponíveis
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {presets.map((preset) => {
            const isSelected = current.id === preset.id;
            const meta = PRESET_METAS[preset.id] || {
              title: preset.id.replace("bg-", ""),
              category: preset.kind,
              previewStyle:
                preset.kind === "color"
                  ? { backgroundColor: preset.value }
                  : { background: preset.value },
            };

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectTheme(preset)}
                className={`group relative flex items-center gap-3.5 rounded-xl border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-2xs"
                    : "border-border bg-card/60 hover:border-zinc-400 hover:bg-accent/40 dark:hover:border-zinc-700"
                }`}
              >
                {/* Visual Thumbnail */}
                <div
                  className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border shadow-xs"
                  style={meta.previewStyle}
                >
                  {preset.kind === "isf" && (
                    <div className="isf-fallback absolute inset-0" />
                  )}
                </div>

                {/* Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-xs text-foreground">
                      {meta.title}
                    </p>
                    {isSelected && (
                      <Badge
                        variant="default"
                        className="h-4 gap-1 px-1.5 text-[9px] font-semibold"
                      >
                        <Check className="size-2.5" />
                        Ao Vivo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {meta.category}
                  </p>
                </div>

                <div className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground">
                  <Sparkles className="size-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
