import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import type { SlideTheme } from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/core/lib/utils";
import { openThemeEditor } from "@/core/ipc/commands";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useDisplaysStore } from "@/features/displays/store";
import { previewTheme } from "@/features/slide-themes/pages";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import { useBackgroundAssets } from "./assets";
import {
  applyBackgroundToOutput,
  applyThemeToOutput,
  clearOverrideForOutput,
  preferredCategoryForTheme,
  resolveApplyTarget,
} from "./applyAsset";
import { setAssetDragData } from "./dnd";
import type { BackgroundAsset } from "./types";

type PanelTab = "themes" | "backgrounds" | "lower" | "shaders";

const TAB_LABELS: Record<PanelTab, string> = {
  themes: "Temas",
  backgrounds: "Fundos",
  lower: "Lower",
  shaders: "Shaders",
};

function AssetThumb({ asset }: { asset: BackgroundAsset }) {
  if (asset.kind === "image") {
    return (
      <img
        src={asset.source}
        alt={asset.name}
        loading="lazy"
        className="size-full object-cover"
      />
    );
  }
  const isIsf = asset.source.startsWith("isf:");
  return (
    <div
      className="size-full"
      style={{
        background: isIsf
          ? "radial-gradient(circle at 50% 120%, #4338ca 0%, #020617 72%)"
          : asset.source,
      }}
    />
  );
}

function ThemeCard({
  theme,
  onApply,
  onEdit,
}: {
  theme: SlideTheme;
  onApply: () => void;
  onEdit: () => void;
}) {
  const preview = previewTheme(theme, "music");
  return (
    <div
      draggable
      onDragStart={(event) => setAssetDragData(event, { type: "theme", themeGuid: theme.guid })}
      className="group flex cursor-grab flex-col gap-1 rounded-lg border border-border bg-card/60 p-1.5 active:cursor-grabbing"
      title="Arraste para um preview de saída"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black pointer-events-none">
        <ScaledStage
          theme={preview.theme}
          asset={preview.asset}
          props={SAMPLES[preview.asset].props}
        />
      </div>
      <div className="flex items-center gap-1 px-0.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{theme.title}</span>
        <button
          type="button"
          onClick={onApply}
          title="Aplicar na saída selecionada"
          className="flex size-5 items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Editar tema"
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Pencil className="size-3" />
        </button>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onApply,
}: {
  asset: BackgroundAsset;
  onApply: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => setAssetDragData(event, { type: "background", asset })}
      className="group flex cursor-grab flex-col gap-1 rounded-lg border border-border bg-card/60 p-1.5 active:cursor-grabbing"
      title="Arraste para um preview de saída"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-900 pointer-events-none">
        <AssetThumb asset={asset} />
      </div>
      <div className="flex items-center gap-1 px-0.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{asset.name}</span>
        <button
          type="button"
          onClick={onApply}
          title="Aplicar na saída selecionada"
          className="flex size-5 items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
        >
          <Check className="size-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Painel de mídia: temas e fundos, arrastáveis para os previews de saída.
 * Substitui o ThemeRail como terceira fonte de tema/fundo.
 */
export function MediaPanel() {
  const [tab, setTab] = useState<PanelTab>("themes");
  const [open, setOpen] = useState(true);

  const themes = useSlideThemesStore((s) => s.themes);
  const outputs = useDisplaysStore((s) => s.outputs);
  const selectedOutputId = useDisplaysStore((s) => s.selectedOutputId);
  const { images, shaders } = useBackgroundAssets();

  const selectedOutput = outputs.find((o) => o.id === selectedOutputId) ?? null;

  const themeList = useMemo(() => {
    const list = themes.filter((theme) => theme.category !== "presentation");
    return tab === "lower" ? list.filter((theme) => theme.category === "stream") : list;
  }, [themes, tab]);

  if (!open) {
    return (
      <aside className="flex w-10 shrink-0 flex-col border-l border-border bg-card/40">
        <div className="flex h-14 items-center justify-center border-b border-border bg-muted/20">
          <button
            type="button"
            aria-label="Expandir painel de mídia"
            title="Mídia"
            onClick={() => setOpen(true)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Painel de mídia"
      className="flex w-64 shrink-0 flex-col border-l border-border bg-card/40"
    >
      <div className="flex h-14 items-center justify-between border-b border-border bg-muted/20 px-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Mídia</span>
          {selectedOutput && (
            <Badge variant="outline" className="max-w-24 truncate text-[9px]">
              {selectedOutput.name}
            </Badge>
          )}
        </div>
        <button
          type="button"
          aria-label="Recolher painel de mídia"
          onClick={() => setOpen(false)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-0.5 border-b border-border bg-muted/30 p-1.5 text-[10px] font-medium">
        {(Object.keys(TAB_LABELS) as PanelTab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "truncate rounded px-1 py-1 text-center transition-colors cursor-pointer",
              tab === value
                ? "bg-background font-semibold text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground">
        <span className="truncate">
          {selectedOutput ? `Alvo: ${selectedOutput.name}` : "Alvo: primeira saída compatível"}
        </span>
        {selectedOutput && (
          <button
            type="button"
            onClick={() => clearOverrideForOutput(selectedOutput.id)}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-accent hover:text-foreground cursor-pointer"
            title="Limpar ação ao vivo desta saída"
          >
            <X className="size-2.5" />
            limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tab === "themes" || tab === "lower" ? (
          themeList.length === 0 ? (
            <p className="p-2 text-[11px] text-muted-foreground">
              Nenhum tema disponível para esta aba.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {themeList.map((theme) => (
                <ThemeCard
                  key={theme.guid}
                  theme={theme}
                  onApply={() => {
                    const target =
                      selectedOutput ?? resolveApplyTarget(preferredCategoryForTheme(theme));
                    if (target) applyThemeToOutput(target, theme.guid);
                  }}
                  onEdit={() => void openThemeEditor(theme.guid)}
                />
              ))}
            </div>
          )
        ) : (
          (() => {
            const list = tab === "backgrounds" ? images : shaders;
            if (list.length === 0) {
              return (
                <p className="p-2 text-[11px] text-muted-foreground">
                  {tab === "backgrounds"
                    ? "Nenhuma imagem na biblioteca. Importe imagens em Imagens."
                    : "Nenhum shader disponível."}
                </p>
              );
            }
            return (
              <div className="grid grid-cols-2 gap-2">
                {list.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onApply={() => {
                      const target = selectedOutput ?? resolveApplyTarget("public");
                      if (target) applyBackgroundToOutput(target, asset);
                    }}
                  />
                ))}
              </div>
            );
          })()
        )}
      </div>

      <div className="border-t border-border px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Arraste um tema ou fundo para o preview de uma saída. A ação vale só para
        aquela saída (ao vivo &gt; evento &gt; padrão).
      </div>
    </aside>
  );
}
