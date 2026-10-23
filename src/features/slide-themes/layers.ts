import type {
  DisplayOutput,
  MasterLayerId,
  OutputCategory,
  OutputLook,
  SlideTheme,
  ThemeElement,
  ThemeElementType,
} from "@/core/types";

/** Ordem de exibição no editor e no Look (topo → base). A composição renderiza de baixo para cima. */
export const MASTER_LAYER_ORDER: readonly MasterLayerId[] = [
  "mask",
  "messages",
  "props",
  "announcements",
  "slide",
  "media",
  "videoInput",
  "screenColor",
] as const;

export const MASTER_LAYER_LABELS: Record<MasterLayerId, string> = {
  mask: "Máscara",
  messages: "Mensagens",
  props: "Props",
  announcements: "Anúncios",
  slide: "Slide",
  media: "Mídia",
  videoInput: "Entrada de Vídeo",
  screenColor: "Cor da Tela",
};

/** Camadas que nunca recebem elementos do editor (sistema / fase 2). */
export const SYSTEM_LAYER_IDS: readonly MasterLayerId[] = [
  "mask",
  "messages",
  "media",
  "videoInput",
  "screenColor",
] as const;

/** Camadas que podem conter elementos movidos manualmente no editor. */
export const ELEMENT_LAYER_IDS: readonly MasterLayerId[] = [
  "slide",
  "props",
  "announcements",
] as const;

/** Camadas com renderer de elementos de tema nesta fase. */
export const LAYER_HAS_ELEMENT_RENDERER: Record<MasterLayerId, boolean> = {
  mask: false,
  messages: false,
  props: false,
  announcements: false,
  slide: true,
  media: false,
  videoInput: false,
  screenColor: false,
};

/**
 * Todo elemento do tema nasce em `slide` — inclusive imagens e vídeos. A camada
 * `media` fica reservada para a media bin/ações de mídia (fase 2), que fica
 * abaixo do fundo do Slide; classificar uma imagem de tema como `media` a
 * esconderia atrás de um fundo opaco.
 */
export function defaultLayerForElement(_type: ThemeElementType): MasterLayerId {
  return "slide";
}

export function elementLayer(element: ThemeElement): MasterLayerId {
  return element.layer ?? "slide";
}

export function elementVisibleForLook(element: ThemeElement, look: OutputLook): boolean {
  const layer = elementLayer(element);
  return LAYER_HAS_ELEMENT_RENDERER[layer] && look[layer];
}

export function normalizeElementLayer(element: ThemeElement): MasterLayerId {
  return elementLayer(element);
}

/**
 * Normaliza, na leitura, um tema v1/v2 sem `layer` — devolve uma cópia com
 * `layer` explícito em cada elemento (sem alterar o objeto original).
 */
export function normalizeThemeLayers(theme: SlideTheme): SlideTheme {
  const withLayer = (el: ThemeElement): ThemeElement =>
    el.layer ? el : { ...el, layer: "slide" };
  return {
    ...theme,
    elements: theme.elements.map(withLayer),
    pages: theme.pages?.map((page) => ({
      ...page,
      elements: page.elements.map(withLayer),
    })),
  };
}

export function filterThemeForLook(theme: SlideTheme, look: OutputLook): SlideTheme {
  return {
    ...theme,
    elements: theme.elements.filter((el) => elementVisibleForLook(el, look)),
  };
}

/**
 * Default do Look por categoria. Preserva o comportamento atual: tudo o que já
 * renderiza continua renderizando. `props`, `announcements` e `videoInput` não
 * têm efeito visível até suas features existirem.
 */
export function defaultLookForCategory(
  category: OutputCategory,
  screenColorEnabled = true,
): OutputLook {
  switch (category) {
    case "stage":
      return {
        mask: false,
        messages: true,
        props: true,
        announcements: true,
        slide: true,
        media: false,
        videoInput: false,
        screenColor: screenColorEnabled,
      };
    case "lower":
      return {
        mask: false,
        messages: true,
        props: false,
        announcements: false,
        slide: true,
        media: true,
        videoInput: false,
        screenColor: screenColorEnabled,
      };
    case "public":
    default:
      return {
        mask: false,
        messages: true,
        props: true,
        announcements: true,
        slide: true,
        media: true,
        videoInput: true,
        screenColor: screenColorEnabled,
      };
  }
}

export function normalizeLook(
  look: OutputLook | null | undefined,
  category: OutputCategory,
  screenColorEnabled = true,
): OutputLook {
  const base = defaultLookForCategory(category, screenColorEnabled);
  if (!look) return base;
  return { ...base, ...look, screenColor: screenColorEnabled };
}

export function resolveOutputLook(output: DisplayOutput): OutputLook {
  return normalizeLook(
    output.look,
    output.category,
    output.backgroundColorEnabled,
  );
}
