import { create } from "zustand";
import type { LiveOutputOverride, LiveOutputPlans } from "@/core/types";

interface OutputOverridesState {
  overrides: Record<string, LiveOutputOverride>;
  setOverride(outputId: string, override: LiveOutputOverride | null): void;
  clearOverride(outputId: string): void;
  clearAll(): void;
  rehydrate(plans: LiveOutputPlans): void;
}

/**
 * Overrides ao vivo por saída (efêmeros, só no admin). Viajam dentro do
 * `OutputPlan` publicado; o Rust não guarda um mapa separado.
 */
export const useOutputOverridesStore = create<OutputOverridesState>((set) => ({
  overrides: {},
  setOverride: (outputId, override) => {
    set((s) => {
      const next = { ...s.overrides };
      if (override) next[outputId] = override;
      else delete next[outputId];
      return { overrides: next };
    });
  },
  clearOverride: (outputId) => {
    set((s) => {
      const next = { ...s.overrides };
      delete next[outputId];
      return { overrides: next };
    });
  },
  clearAll: () => {
    set({ overrides: {} });
  },
  rehydrate: (plans) => {
    const next: Record<string, LiveOutputOverride> = {};
    for (const [outputId, plan] of Object.entries(plans.plans)) {
      const hasOverride =
        Boolean(plan.backgroundOverride) || plan.themeSource === "override";
      if (!hasOverride) continue;
      next[outputId] = {
        themeGuid: plan.themeSource === "override" ? (plan.theme?.guid ?? null) : null,
        background: plan.backgroundOverride ?? null,
        updatedAt: plan.updatedAt,
      };
    }
    set({ overrides: next });
  },
}));
