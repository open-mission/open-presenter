import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Layers,
  Pencil,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";
import type { SlideTheme } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { openThemeEditor } from "@/core/ipc/commands";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useDisplaysStore } from "@/features/displays/store";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
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

const TAB_INFO: { id: PanelTab; label: string; icon: typeof Layers }[] = [
  { id: "themes", label: "Temas", icon: Layers },
  { id: "backgrounds", label: "Fundos", icon: ImageIcon },
  { id: "lower", label: "Lower", icon: ScanLine },
  { id: "shaders", label: "Shaders", icon: Sparkles },
];

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
 * Painel inferior de mídia (estilo media bin do ProPresenter): abas em sidebar
 * vertical e conteúdo redimensionável. Arraste temas/fundos para os previews.
 */
export function MediaPanel() {
  const [tab, setTab] = useState<PanelTab>("themes");
  const open = usePanelLayoutStore((s) => s.mediaOpen);
  const setOpen = usePanelLayoutStore((s) => s.setMediaOpen);

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
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-card/40 px-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
          title="Expandir painel de mídia"
        >
          <ChevronUp className="size-3.5" />
          Mídia
        </button>
        <span className="truncate text-[10px] text-muted-foreground">
          {selectedOutput ? `Alvo: ${selectedOutput.name}` : "Arraste temas/fundos para os previews"}
        </span>
      </div>
    );
  }

  return (
    <section
      aria-label="Painel de mídia"
      className="flex h-full w-full min-h-0 border-t border-border bg-card/40"
    >
      {/* Sidebar vertical de abas */}
      <div className="flex w-32 shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="flex h-9 items-center justify-between border-b border-border px-2">
          <span className="text-xs font-semibold text-foreground">Mídia</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Recolher painel de mídia"
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-1">
          {TAB_INFO.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors cursor-pointer",
                tab === id
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center justify-between border-b border-border px-3 text-[11px]">
          <span className="truncate text-muted-foreground">
            {selectedOutput
              ? `Alvo: ${selectedOutput.name}`
              : "Alvo: primeira saída compatível"}
          </span>
          {selectedOutput && (
            <button
              type="button"
              onClick={() => clearOverrideForOutput(selectedOutput.id)}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
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
              <div className="grid [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-2">
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
                <div className="grid [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-2">
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
      </div>
    </section>
  );
}
