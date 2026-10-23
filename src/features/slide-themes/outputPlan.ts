import type {
  BackgroundLayer,
  DisplayOutput,
  LiveOutputOverride,
  OutputCategory,
  OutputPlan,
  PlanThemeSource,
  SlideContent,
  SlideTheme,
} from "@/core/types";
import { contextForSlide } from "./themeResolution.ts";
import { getPageForContext, materializePage } from "./pages.ts";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_THEME,
  DEFAULT_STREAM_THEME,
  DEFAULT_STREAM_THEME_GUID,
} from "./seedThemes.ts";
import { resolveOutputLook } from "./layers.ts";

function findByGuid(
  themes: readonly SlideTheme[],
  guid: string | null | undefined,
): SlideTheme | null {
  if (!guid) return null;
  return themes.find((theme) => theme.guid === guid) ?? null;
}

/**
 * Compatibilidade de tema por categoria de saída (seletor de tema padrão).
 * Público aceita temas públicos/apresentação; Stage só temas de palco; Lower
 * Third só temas de transmissão.
 */
export function themeSupportsCategory(
  theme: SlideTheme,
  category: OutputCategory,
): boolean {
  if (category === "stage") return theme.category === "stage";
  if (category === "lower") {
    return theme.category === "stream" || theme.guid === DEFAULT_STREAM_THEME_GUID;
  }
  return theme.category !== "stage" && theme.category !== "stream";
}

export function defaultThemeForCategory(category: OutputCategory): SlideTheme {
  if (category === "stage") return DEFAULT_STAGE_THEME;
  if (category === "lower") return DEFAULT_STREAM_THEME;
  return DEFAULT_PUBLIC_THEME;
}

/**
 * Tema do conteúdo (`live.content.media.themeId`): é parte do conteúdo, não uma
 * escolha de tela. Um deck (`presentation`) vale em qualquer saída; nos demais
 * casos valem as regras de categoria (Lower Third só stream).
 */
export function resolveContentTheme(
  mediaThemeId: string | null | undefined,
  themes: readonly SlideTheme[],
  category: OutputCategory,
): SlideTheme | null {
  const theme = findByGuid(themes, mediaThemeId);
  if (!theme) return null;
  if (theme.category === "presentation") return theme;
  if (category === "lower") {
    return theme.category === "stream" || theme.guid === DEFAULT_STREAM_THEME_GUID
      ? theme
      : null;
  }
  if (category === "stage") {
    return theme.category === "stage" ? theme : null;
  }
  return theme.category !== "stage" && theme.category !== "stream" ? theme : null;
}

/** Compatibilidade de fundo/ativo por categoria. Lower Third só aceita cor/transparente. */
export function isBackgroundCompatible(
  category: OutputCategory,
  background: BackgroundLayer | null | undefined,
): boolean {
  if (!background) return true;
  if (category === "lower") return background.kind === "color";
  return true;
}

function isIsfValue(value: string): boolean {
  const s = value.trim();
  return s.startsWith("isf:") || (s.includes("/*{") && s.includes("void main"));
}

export function cssBackgroundLayer(value: string, id: string): BackgroundLayer {
  return { id, kind: isIsfValue(value) ? "isf" : "css", value };
}

export function themeBackgroundLayer(theme: SlideTheme | null): BackgroundLayer | null {
  const value = theme?.css?.background?.trim();
  if (!value) return null;
  return cssBackgroundLayer(value, `theme-bg-${theme?.guid ?? "none"}`);
}

export function isCustomLiveBackground(background: BackgroundLayer | null | undefined): boolean {
  if (!background) return false;
  return background.kind !== "color" || (background.value !== "" && background.value !== "#000000");
}

export interface ResolvedOutputTheme {
  theme: SlideTheme | null;
  source: PlanThemeSource;
}

export function resolveOutputTheme(input: {
  category: OutputCategory;
  themes: readonly SlideTheme[];
  defaultThemeGuid?: string | null;
  eventThemeGuid?: string | null;
  overrideThemeGuid?: string | null;
}): ResolvedOutputTheme {
  const { category, themes } = input;

  const override = findByGuid(themes, input.overrideThemeGuid);
  if (override && themeSupportsCategory(override, category)) {
    return { theme: override, source: "override" };
  }

  if (category !== "stage") {
    const event = findByGuid(themes, input.eventThemeGuid);
    if (event && themeSupportsCategory(event, category)) {
      return { theme: event, source: "event" };
    }
  }

  const defined = findByGuid(themes, input.defaultThemeGuid);
  if (defined && themeSupportsCategory(defined, category)) {
    return { theme: defined, source: "default" };
  }

  return { theme: defaultThemeForCategory(category), source: "fallback" };
}

/**
 * Tema de descanso do Stage. `idleThemeGuid` explícito vence a página `rest` do
 * tema ativo; sem ele, a página `rest`; sem nenhum, o padrão do sistema.
 */
export function resolveRestTheme(input: {
  themes: readonly SlideTheme[];
  idleThemeGuid?: string | null;
  activeTheme?: SlideTheme | null;
}): SlideTheme {
  const idle = findByGuid(input.themes, input.idleThemeGuid);
  if (idle) return idle;
  if (input.activeTheme && getPageForContext(input.activeTheme, "rest")) {
    return input.activeTheme;
  }
  return DEFAULT_STAGE_REST_THEME;
}

/**
 * Precedência de fundo (níveis acima da Cor da Tela, que é o fallback absoluto
 * desenhado pelo próprio render):
 * conteúdo > override ao vivo > fundo do slide ao vivo > fundo do tema.
 */
export function resolveOutputBackground(input: {
  category: OutputCategory;
  contentTheme?: SlideTheme | null;
  overrideBackground?: BackgroundLayer | null;
  liveBackground?: BackgroundLayer | null;
  theme?: SlideTheme | null;
}): BackgroundLayer | null {
  const contentBg = themeBackgroundLayer(input.contentTheme ?? null);
  if (contentBg) return contentBg;

  if (
    input.overrideBackground &&
    isBackgroundCompatible(input.category, input.overrideBackground)
  ) {
    return input.overrideBackground;
  }

  if (isCustomLiveBackground(input.liveBackground ?? null)) {
    return input.liveBackground ?? null;
  }

  return themeBackgroundLayer(input.theme ?? null);
}

export function materializeThemeForContent(
  theme: SlideTheme | null,
  content?: SlideContent | null,
): SlideTheme | null {
  if (!theme) return null;
  if (!theme.pages?.length) return theme;

  if (theme.category === "presentation") {
    const index = content?.media?.index ?? 0;
    const page = theme.pages[index] ?? theme.pages[0];
    return page ? materializePage(theme, page) : theme;
  }

  const context = content ? contextForSlide(content.kind, content.media?.kind) : null;
  if (!context) return theme;
  const page = getPageForContext(theme, context);
  return page ? materializePage(theme, page) : theme;
}

export function resolveOutputPlan(input: {
  output: DisplayOutput;
  themes: readonly SlideTheme[];
  eventThemeGuid?: string | null;
  override?: LiveOutputOverride | null;
  content?: SlideContent | null;
  now?: string;
}): OutputPlan {
  const { output, themes } = input;
  const category = output.category;

  const resolved = resolveOutputTheme({
    category,
    themes,
    defaultThemeGuid: output.defaultThemeGuid,
    eventThemeGuid: input.eventThemeGuid,
    overrideThemeGuid: input.override?.themeGuid ?? null,
  });

  const contentTheme = resolveContentTheme(
    input.content?.media?.themeId ?? null,
    themes,
    category,
  );

  const restTheme =
    category === "stage"
      ? resolveRestTheme({
          themes,
          idleThemeGuid: output.idleThemeGuid,
          activeTheme: resolved.theme,
        })
      : null;

  return {
    outputId: output.id,
    category,
    theme: resolved.theme,
    themeSource: resolved.source,
    contentTheme,
    restTheme,
    look: resolveOutputLook(output),
    backgroundOverride: input.override?.background ?? null,
    screenColor: {
      enabled: output.backgroundColorEnabled,
      value: output.backgroundColor,
    },
    updatedAt: input.now ?? new Date().toISOString(),
  };
}

/**
 * Plano degradado quando o admin nunca publicou: usa o tema padrão da saída e
 * os defaults da categoria, sem evento nem ação ao vivo.
 */
export function fallbackPlanForOutput(
  output: DisplayOutput,
  themes: readonly SlideTheme[],
  now?: string,
): OutputPlan {
  return resolveOutputPlan({ output, themes, now });
}

function syntheticOutput(category: OutputCategory): DisplayOutput {
  return {
    id: `__system_${category}__`,
    name: `Sistema (${category})`,
    category,
    type: "html",
    enabled: true,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: "16:9",
    backgroundColor: category === "lower" ? "rgba(0,0,0,0)" : "#000000",
    backgroundColorEnabled: category !== "lower",
    frameRate: 60,
    videoDelayFrames: 0,
    alphaKey: category === "lower",
  };
}

export function systemPlanForCategory(
  category: OutputCategory,
  themes: readonly SlideTheme[],
  now?: string,
): OutputPlan {
  return resolveOutputPlan({ output: syntheticOutput(category), themes, now });
}
