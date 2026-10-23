import { create } from "zustand";
import type { LiveOutputPlans, OutputPlan } from "@/core/types";

const EMPTY_PLANS: LiveOutputPlans = { plans: {} };

function normalizePlan(value: unknown): OutputPlan | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<OutputPlan>;
  if (typeof candidate.outputId !== "string") return null;
  return candidate as OutputPlan;
}

function normalize(value: unknown): LiveOutputPlans {
  if (typeof value !== "object" || value === null) return EMPTY_PLANS;
  const record = value as { plans?: unknown };
  if (typeof record.plans !== "object" || record.plans === null) return EMPTY_PLANS;
  const plans: Record<string, OutputPlan> = {};
  for (const [key, raw] of Object.entries(record.plans as Record<string, unknown>)) {
    const plan = normalizePlan(raw);
    if (plan) plans[key] = plan;
  }
  return { plans };
}

interface OutputPlansState {
  plans: LiveOutputPlans;
  applyRemote(plans: unknown): void;
}

/**
 * Planos por saída resolvidos pelo admin e recebidos via syncBus (eventos Tauri
 * no desktop, WebSocket `/ws` no navegador). Cada saída lê o plano do seu id.
 */
export const useOutputPlansStore = create<OutputPlansState>((set) => ({
  plans: EMPTY_PLANS,
  applyRemote: (plans) => set({ plans: normalize(plans) }),
}));

export function selectOutputPlan(
  plans: LiveOutputPlans,
  outputId: string | null | undefined,
): OutputPlan | null {
  if (!outputId) return null;
  return plans.plans[outputId] ?? null;
}

export { EMPTY_PLANS };
