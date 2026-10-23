import { toast } from "sonner";
import type { DisplayOutput, OutputCategory, SlideTheme } from "@/core/types";
import { useDisplaysStore } from "@/features/displays/store";
import { themeSupportsCategory } from "@/features/slide-themes/outputPlan";
import { useOutputOverridesStore } from "@/features/slide-themes/outputOverridesStore";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import {
  assetSupportsOutput,
  backgroundFromAsset,
  type BackgroundAsset,
} from "./types";

export function preferredCategoryForTheme(theme: SlideTheme): OutputCategory {
  if (theme.category === "stage") return "stage";
  if (theme.category === "stream") return "lower";
  return "public";
}

/**
 * Alvo da ação "aplicar": a saída selecionada no painel de Displays; sem
 * seleção, a primeira saída habilitada da categoria.
 */
export function resolveApplyTarget(preferred: OutputCategory): DisplayOutput | null {
  const store = useDisplaysStore.getState();
  if (store.selectedOutputId) {
    const selected = store.outputs.find((o) => o.id === store.selectedOutputId);
    if (selected) return selected;
  }
  return (
    store.outputs.find((o) => o.category === preferred && o.enabled) ??
    store.outputs.find((o) => o.category === preferred) ??
    null
  );
}

function currentOverride(outputId: string) {
  return useOutputOverridesStore.getState().overrides[outputId] ?? null;
}

/** Aplica um tema só naquela saída (override ao vivo). */
export function applyThemeToOutput(output: DisplayOutput, themeGuid: string): boolean {
  const theme = useSlideThemesStore
    .getState()
    .themes.find((candidate) => candidate.guid === themeGuid);
  if (!theme) {
    toast.error("Tema não encontrado.");
    return false;
  }
  if (!themeSupportsCategory(theme, output.category)) {
    toast.error(`Tema "${theme.title}" não é compatível com esta saída.`);
    return false;
  }
  const current = currentOverride(output.id);
  useOutputOverridesStore.getState().setOverride(output.id, {
    themeGuid,
    background: current?.background ?? null,
    updatedAt: new Date().toISOString(),
  });
  toast.success(`Tema "${theme.title}" aplicado em ${output.name}.`);
  return true;
}

/** Aplica um fundo só naquela saída (override ao vivo). */
export function applyBackgroundToOutput(
  output: DisplayOutput,
  asset: BackgroundAsset,
): boolean {
  if (!assetSupportsOutput(asset, output.category)) {
    toast.error(`"${asset.name}" não é compatível com esta saída.`);
    return false;
  }
  const background = backgroundFromAsset(asset);
  if (output.category === "lower" && background.kind !== "color") {
    toast.error("Lower Third aceita apenas fundo de cor/transparente.");
    return false;
  }
  const current = currentOverride(output.id);
  useOutputOverridesStore.getState().setOverride(output.id, {
    themeGuid: current?.themeGuid ?? null,
    background,
    updatedAt: new Date().toISOString(),
  });
  toast.success(`Fundo "${asset.name}" aplicado em ${output.name}.`);
  return true;
}

export function clearOverrideForOutput(outputId: string): void {
  useOutputOverridesStore.getState().clearOverride(outputId);
}
