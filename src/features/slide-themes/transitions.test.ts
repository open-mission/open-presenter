import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAnimationNames } from "./transitions.ts";

describe("Theme Element Transitions", () => {
  it("mapeia tipos de transição para os pares de keyframes corretos", () => {
    assert.deepEqual(getAnimationNames("fade"), {
      inAnimation: "slideFadeIn",
      outAnimation: "slideFadeOut",
    });

    assert.deepEqual(getAnimationNames("fade-up"), {
      inAnimation: "slideFadeUpIn",
      outAnimation: "slideFadeUpOut",
    });

    assert.deepEqual(getAnimationNames("fade-down"), {
      inAnimation: "slideFadeDownIn",
      outAnimation: "slideFadeDownOut",
    });

    assert.deepEqual(getAnimationNames("fade-left"), {
      inAnimation: "slideFadeLeftIn",
      outAnimation: "slideFadeLeftOut",
    });

    assert.deepEqual(getAnimationNames("fade-right"), {
      inAnimation: "slideFadeRightIn",
      outAnimation: "slideFadeRightOut",
    });

    assert.deepEqual(getAnimationNames("none"), {
      inAnimation: "none",
      outAnimation: "none",
    });

    // Fallback para tipos desconhecidos deve ser fade
    assert.deepEqual(getAnimationNames("unknown-custom"), {
      inAnimation: "slideFadeIn",
      outAnimation: "slideFadeOut",
    });
  });
});
