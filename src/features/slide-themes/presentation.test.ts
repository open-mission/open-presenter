import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyStudioTheme,
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_THEME,
} from "./seedThemes.ts";
import { buildMediaSlides } from "../../core/lib/media.ts";
import type { MediaItem, SlideTheme } from "../../core/types/index.ts";

test("createEmptyStudioTheme cria apresentação com categoria, datas e elementos padrão", () => {
  const presentation = createEmptyStudioTheme("Aviso de Domingo");

  assert.equal(presentation.title, "Aviso de Domingo");
  assert.equal(presentation.category, "presentation");
  assert.ok(presentation.guid.length > 0);
  assert.ok(presentation.createdAt);
  assert.ok(presentation.updatedAt);
  assert.equal(presentation.elements.length, 2);
  assert.equal(presentation.elements[0].text, "Aviso de Domingo");
  assert.ok(presentation.css?.background?.includes("linear-gradient"));
  assert.equal(presentation.pages?.length, 1);
  assert.equal(presentation.pages?.[0].name, "Slide 1");
  assert.equal(presentation.pages?.[0].elements.length, 2);
});

test("buildMediaSlides gera múltiplos slides para apresentação com várias páginas", () => {
  const presentation: SlideTheme = {
    guid: "pres-multi",
    title: "Avisos Gerais",
    category: "presentation",
    css: { background: "#000000" },
    elements: [],
    pages: [
      { id: "p1", context: "text", name: "Boas-vindas", css: {}, elements: [] },
      { id: "p2", context: "text", name: "Culto de Oração", css: {}, elements: [] },
      { id: "p3", context: "text", name: "Dízimos e Ofertas", css: {}, elements: [] },
    ],
  };

  const media: MediaItem = {
    kind: "text",
    title: "Avisos Gerais",
    themeId: "pres-multi",
  };

  const runnerSlides = buildMediaSlides("item-avisos", media, presentation);

  assert.equal(runnerSlides.length, 3);
  assert.equal(runnerSlides[0].label, "Boas-vindas");
  assert.equal(runnerSlides[0].slide.media?.index, 0);
  assert.equal(runnerSlides[0].slide.section, "1/3");

  assert.equal(runnerSlides[1].label, "Culto de Oração");
  assert.equal(runnerSlides[1].slide.media?.index, 1);
  assert.equal(runnerSlides[1].slide.section, "2/3");

  assert.equal(runnerSlides[2].label, "Dízimos e Ofertas");
  assert.equal(runnerSlides[2].slide.media?.index, 2);
  assert.equal(runnerSlides[2].slide.section, "3/3");
});

test("createEmptyStudioTheme respeita gradiente ou fundo customizado", () => {
  const customBg = "linear-gradient(135deg, #064e3b 0%, #000000 100%)";
  const presentation = createEmptyStudioTheme("Ceia do Senhor", customBg);

  assert.equal(presentation.title, "Ceia do Senhor");
  assert.equal(presentation.css?.background, customBg);
  assert.equal(presentation.category, "presentation");
});

test("tema público padrão tem uma página para cada contexto", () => {
  assert.equal(DEFAULT_PUBLIC_THEME.category, "theme");
  assert.deepEqual(
    DEFAULT_PUBLIC_THEME.pages?.map((page) => page.context),
    ["music", "bible", "text"],
  );
  assert.equal(DEFAULT_PUBLIC_THEME.elements.length, 0);
});

test("temas de retorno usam a categoria stage", () => {
  assert.equal(DEFAULT_STAGE_THEME.category, "stage");
  assert.deepEqual(
    DEFAULT_STAGE_THEME.pages?.map((page) => page.context),
    ["rest", "music", "bible", "text"],
  );
  assert.equal(DEFAULT_STAGE_THEME.elements.length, 0);
});
