import test from "node:test";
import assert from "node:assert/strict";
import {
  cloneTheme,
  createPage,
  getActivePage,
  getPageForContext,
  materializePage,
  previewTheme,
  themeCoverageLabel,
  themeVersion,
} from "./pages.ts";
import type { SlideTheme, ThemeElement } from "@/core/types";

function element(id: string): ThemeElement {
  return { id, type: "TEXT", x: 0, y: 0, visible: true, locked: false, css: {}, text: id };
}

function base(overrides: Partial<SlideTheme> = {}): SlideTheme {
  return {
    guid: "t",
    title: "Tema",
    category: "theme",
    css: { background: "#000" },
    elements: [element("a")],
    ...overrides,
  };
}

test("materializa a página mantendo o restante do tema", () => {
  const page = { id: "p", context: "text" as const, css: { background: "#fff" }, elements: [element("x")] };
  const theme = base({ pages: [page] });
  const view = materializePage(theme, page);
  assert.deepEqual(view.css, page.css);
  assert.equal(view.elements[0].id, "x");
  assert.equal(view.pages?.length, 1);
});

test("página ativa cai na primeira quando o id não existe", () => {
  const page = { id: "p1", context: "music" as const, css: {}, elements: [] };
  const theme = base({ pages: [page] });
  assert.equal(getActivePage(theme, "nao-existe")?.id, "p1");
  assert.equal(getPageForContext(theme, "text"), null);
});

test("preview usa a página do asset e cai na primeira", () => {
  const music = { id: "m", context: "music" as const, css: {}, elements: [] };
  const text = { id: "t", context: "text" as const, css: {}, elements: [] };
  const theme = base({ pages: [text, music] });
  assert.equal(previewTheme(theme, "music").theme.elements.length, 0);
  assert.equal(previewTheme(theme, "bible").asset, "text");
});

test("classifica versão e cobertura", () => {
  assert.equal(themeVersion(base()), "v1");
  assert.equal(themeVersion(base({ pages: [] })), "v1");
  assert.equal(themeVersion(base({ pages: [{ id: "p", context: "music", css: {}, elements: [] }] })), "v2");
  assert.equal(themeVersion(base({ category: "stage" })), "single");
  assert.equal(themeCoverageLabel(base()), "Layout único");
  assert.equal(
    themeCoverageLabel(base({ pages: [{ id: "p", context: "music", css: {}, elements: [] }] })),
    "Música",
  );
});

test("cria página duplicada com ids novos e página em branco sem elementos", () => {
  const theme = base();
  const source = { id: "src", context: "music" as const, css: { background: "#123" }, elements: [element("orig")] };
  const dup = createPage(theme, "bible", "duplicate", source);
  assert.equal(dup.context, "bible");
  assert.notEqual(dup.elements[0].id, "orig");
  assert.deepEqual(dup.css, source.css);
  const blank = createPage(theme, "text", "blank", source);
  assert.equal(blank.elements.length, 0);
  assert.equal(blank.css.background, "#000000");
});

test("clona tema regenerando guids de páginas e elementos", () => {
  const theme = base({
    pages: [{ id: "p1", context: "music", css: {}, elements: [element("e1")] }],
  });
  const cloned = cloneTheme(theme);
  assert.notEqual(cloned.guid, theme.guid);
  assert.notEqual(cloned.pages?.[0].id, "p1");
  assert.notEqual(cloned.pages?.[0].elements[0].id, "e1");
  assert.equal(cloned.title, "Tema (Cópia)");
});
