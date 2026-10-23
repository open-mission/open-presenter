import { useMemo } from "react";
import type { DisplayOutput, OutputCategory, OutputPlan, SlideTheme } from "@/core/types";
import { useDisplaysStore } from "@/features/displays/store";
import { useSlideThemesStore } from "./store";
import { selectOutputPlan, useOutputPlansStore } from "./outputPlansStore";
import {
  defaultThemeForCategory,
  fallbackPlanForOutput,
  systemPlanForCategory,
} from "./outputPlan";

/**
 * Identidade da saída: `?id=` vence; sem id (ou id desconhecido), cai na
 * primeira saída habilitada da categoria (ordem do cadastro).
 */
export function resolveOutputForView(
  outputs: readonly DisplayOutput[],
  category: OutputCategory,
  outputId?: string | null,
): DisplayOutput | null {
  if (outputId) {
    const byId = outputs.find((o) => o.id === outputId);
    if (byId) return byId;
  }
  return (
    outputs.find((o) => o.category === category && o.enabled) ??
    outputs.find((o) => o.category === category) ??
    null
  );
}

export interface OutputPlanView {
  output: DisplayOutput | null;
  plan: OutputPlan;
}

/**
 * Plano da saída para o renderer. Usa o plano publicado pelo admin; sem plano,
 * cai no modo degradado (tema padrão da saída + defaults da categoria).
 */
export function useOutputPlan(
  category: OutputCategory,
  outputId?: string | null,
): OutputPlanView {
  const outputs = useDisplaysStore((s) => s.outputs);
  const themes = useSlideThemesStore((s) => s.themes);
  const plans = useOutputPlansStore((s) => s.plans);

  return useMemo(() => {
    const output = resolveOutputForView(outputs, category, outputId);
    const plan =
      (output ? selectOutputPlan(plans, output.id) : null) ??
      (output
        ? fallbackPlanForOutput(output, themes)
        : systemPlanForCategory(category, themes));
    return { output, plan };
  }, [outputs, themes, plans, category, outputId]);
}

/**
 * Documento do tema que a categoria usa hoje (plano da primeira saída), para
 * previews de letras/slides no admin.
 */
export function useOutputThemeDocument(category: OutputCategory): SlideTheme {
  const { plan } = useOutputPlan(category, null);
  return plan.theme ?? defaultThemeForCategory(category);
}

/** Define o tema padrão da primeira saída da categoria (ação "usar como padrão"). */
export function setCategoryDefaultTheme(
  category: OutputCategory,
  guid: string | null,
): void {
  const store = useDisplaysStore.getState();
  const output = resolveOutputForView(store.outputs, category, null);
  if (output) void store.updateOutput(output.id, { defaultThemeGuid: guid });
}
