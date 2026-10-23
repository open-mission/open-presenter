import { useEffect, useRef } from "react";
import type { LiveOutputPlans, OutputPlan } from "@/core/types";
import { isTauri } from "@/core/ipc/tauri";
import { setLiveOutputPlans } from "@/core/ipc/commands";
import { useDisplaysStore } from "@/features/displays/store";
import { useSlideThemesStore } from "./store";
import { useOutputOverridesStore } from "./outputOverridesStore";
import { useOutputPlansStore } from "./outputPlansStore";
import { resolveOutputPlan } from "./outputPlan";

/**
 * Publica, a partir do admin, o plano resolvido de cada saída. O admin é o único
 * resolvedor; o Rust só guarda e faz broadcast. Republica quando saídas, temas,
 * tema do evento ou overrides mudam — não a cada slide (o tema do conteúdo é
 * aplicado no renderer).
 */
export function useOutputPlansPublisher(): void {
  const outputs = useDisplaysStore((s) => s.outputs);
  const themes = useSlideThemesStore((s) => s.themes);
  const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
  const overrides = useOutputOverridesStore((s) => s.overrides);
  const rehydrate = useOutputOverridesStore((s) => s.rehydrate);
  const remotePlans = useOutputPlansStore((s) => s.plans);

  // Reidrata os overrides ao vivo a partir do último plano publicado quando o
  // admin monta (reload da janela não perde a ação ao vivo).
  const didRehydrate = useRef(false);
  useEffect(() => {
    if (didRehydrate.current) return;
    if (Object.keys(remotePlans.plans).length === 0) return;
    didRehydrate.current = true;
    rehydrate(remotePlans);
  }, [remotePlans, rehydrate]);

  useEffect(() => {
    if (!isTauri()) return;
    const plans: Record<string, OutputPlan> = {};
    for (const output of outputs) {
      plans[output.id] = resolveOutputPlan({
        output,
        themes,
        eventThemeGuid,
        override: overrides[output.id] ?? null,
      });
    }
    const payload: LiveOutputPlans = { plans };
    void setLiveOutputPlans(payload);
  }, [outputs, themes, eventThemeGuid, overrides]);
}
