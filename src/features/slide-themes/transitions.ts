export type LayerTransitionType =
  | "none"
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right";

export interface AnimationNames {
  inAnimation: string;
  outAnimation: string;
}

/**
 * Mapeia o tipo de transição para o par de keyframes CSS correspondentes.
 */
export function getAnimationNames(type: string): AnimationNames {
  switch (type) {
    case "fade-up":
      return { inAnimation: "slideFadeUpIn", outAnimation: "slideFadeUpOut" };
    case "fade-down":
      return { inAnimation: "slideFadeDownIn", outAnimation: "slideFadeDownOut" };
    case "fade-left":
      return { inAnimation: "slideFadeLeftIn", outAnimation: "slideFadeLeftOut" };
    case "fade-right":
      return { inAnimation: "slideFadeRightIn", outAnimation: "slideFadeRightOut" };
    case "none":
      return { inAnimation: "none", outAnimation: "none" };
    case "fade":
    default:
      return { inAnimation: "slideFadeIn", outAnimation: "slideFadeOut" };
  }
}
