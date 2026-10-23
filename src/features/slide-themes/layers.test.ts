import test from "node:test";
import assert from "node:assert/strict";
import {
  MASTER_LAYER_ORDER,
  defaultLayerForElement,
  defaultLookForCategory,
  elementLayer,
  elementVisibleForLook,
  filterThemeForLook,
  normalizeLook,
  normalizeThemeLayers,
  resolveOutputLook,
} from "./layers.ts";
import type { DisplayOutput, MasterLayerId, OutputLook, SlideTheme, ThemeElement } from "@/core/types";

const element = (
  type: ThemeElement["type"],
  layer?: MasterLayerId,
  id = "el",
): ThemeElement => ({ id, type, x: 0, y: 0, visible: true, locked: false, css: {}, layer });

const theme = (elements: ThemeElement[], pages?: SlideTheme["pages"]): SlideTheme => ({
  guid: "t1",
  title: "T",
  css: {},
  elements,
  pages,
});

test("as 8 camadas mestras estão na ordem do design", () => {
  assert.deepEqual([...MASTER_LAYER_ORDER], [
    "mask",
    "messages",
    "props",
    "announcements",
    "slide",
    "media",
    "videoInput",
    "screenColor",
  ]);
});

test("todo elemento nasce em slide, inclusive imagem e vídeo", () => {
  for (const type of ["TEXT", "IMAGE", "VIDEO", "RECTANGLE", "CIRCLE", "TRIANGLE", "STAR"] as const) {
    assert.equal(defaultLayerForElement(type), "slide");
  }
});

test("elemento sem layer efetivo é slide", () => {
  assert.equal(elementLayer(element("TEXT")), "slide");
  assert.equal(elementLayer(element("IMAGE", "props")), "props");
});

test("filtro por look só renderiza elementos da camada slide nesta fase", () => {
  const look = defaultLookForCategory("public");
  assert.equal(elementVisibleForLook(element("TEXT"), look), true);
  assert.equal(elementVisibleForLook(element("TEXT"), { ...look, slide: false }), false);
  // props/announcements ainda não têm renderer nesta fase
  assert.equal(elementVisibleForLook(element("IMAGE", "props"), look), false);
  assert.equal(elementVisibleForLook(element("IMAGE", "announcements"), look), false);
});

test("defaults de look por categoria", () => {
  const pub = defaultLookForCategory("public");
  assert.deepEqual(pub, {
    mask: false,
    messages: true,
    props: true,
    announcements: true,
    slide: true,
    media: true,
    videoInput: true,
    screenColor: true,
  });
  const stage = defaultLookForCategory("stage");
  assert.equal(stage.slide, true);
  assert.equal(stage.messages, true);
  assert.equal(stage.media, false);
  assert.equal(stage.videoInput, false);
  const lower = defaultLookForCategory("lower");
  assert.equal(lower.slide, true);
  assert.equal(lower.media, true);
  assert.equal(lower.props, false);
  assert.equal(lower.announcements, false);
});

test("normalizeLook preenche defaults e sincroniza screenColor", () => {
  const partial = { slide: false } as OutputLook;
  const normalized = normalizeLook(partial, "public", false);
  assert.equal(normalized.slide, false);
  assert.equal(normalized.messages, true);
  assert.equal(normalized.screenColor, false);
  assert.deepEqual(normalizeLook(null, "lower", false), defaultLookForCategory("lower", false));
});

test("resolveOutputLook lê o look salvo e a cor da tela da saída", () => {
  const output = {
    category: "lower",
    backgroundColorEnabled: false,
    look: { ...defaultLookForCategory("lower"), slide: false },
  } as DisplayOutput;
  const look = resolveOutputLook(output);
  assert.equal(look.slide, false);
  assert.equal(look.screenColor, false);
});

test("normalizeThemeLayers materializa layer slide sem mudar o original", () => {
  const original = element("TEXT");
  const normalized = normalizeThemeLayers(
    theme([original], [{ id: "p1", context: "music", css: {}, elements: [element("TEXT", undefined, "p-el")] }]),
  );
  assert.equal(normalized.elements[0].layer, "slide");
  assert.equal(normalized.pages?.[0].elements[0].layer, "slide");
  assert.equal(original.layer, undefined);
});

test("filterThemeForLook remove elementos de camadas sem renderer e slide desligado", () => {
  const t = theme([
    element("TEXT", "slide", "a"),
    element("IMAGE", "props", "b"),
  ]);
  assert.deepEqual(filterThemeForLook(t, defaultLookForCategory("public")).elements.map((e) => e.id), ["a"]);
  assert.deepEqual(
    filterThemeForLook(t, { ...defaultLookForCategory("public"), slide: false }).elements,
    [],
  );
});
