import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyStudioTheme } from "./seedThemes.ts";

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
});

test("createEmptyStudioTheme respeita gradiente ou fundo customizado", () => {
  const customBg = "linear-gradient(135deg, #064e3b 0%, #000000 100%)";
  const presentation = createEmptyStudioTheme("Ceia do Senhor", customBg);

  assert.equal(presentation.title, "Ceia do Senhor");
  assert.equal(presentation.css?.background, customBg);
  assert.equal(presentation.category, "presentation");
});
