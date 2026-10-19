import test from "node:test";
import assert from "node:assert/strict";
import { buildThemePackage, buildThemesBackup, parseThemeFromJson } from "./themePackage.ts";
import type { SlideTheme } from "@/core/types";

function v2(): SlideTheme {
  return {
    guid: "g1",
    title: "Festividade",
    category: "theme",
    css: {},
    elements: [],
    pages: [
      {
        id: "p1",
        context: "music",
        css: { background: "#000" },
        elements: [
          { id: "e1", name: "Letra", type: "TEXT", x: 0, y: 0, visible: true, locked: false, css: {}, text: "{lyrics}" },
        ],
      },
      { id: "p2", context: "text", css: { background: "#111" }, elements: [] },
    ],
  };
}

test("exporta sempre em v2 preservando páginas e nomes", () => {
  const pkg = buildThemePackage(v2());
  assert.equal(pkg.version, 2);
  assert.equal(pkg.theme.pages?.length, 2);
  assert.equal(pkg.theme.pages?.[0].elements[0].name, "Letra");
});

test("importa v2 e regenera o guid", () => {
  const pkg = JSON.stringify(buildThemePackage(v2()));
  const imported = parseThemeFromJson(pkg);
  assert.notEqual(imported.guid, "g1");
  assert.equal(imported.pages?.length, 2);
  assert.equal(imported.pages?.[1].elements.length, 0);
});

test("importa v1 sem pages como tema v1", () => {
  const imported = parseThemeFromJson({
    format: "open-presenter-theme",
    version: 1,
    theme: {
      title: "Antigo",
      css: { background: "#000" },
      elements: [{ id: "e", type: "TEXT", x: 0, y: 0, visible: true, locked: false, css: {}, text: "oi" }],
    },
  });
  assert.equal(imported.pages, undefined);
  assert.equal(imported.elements.length, 1);
});

test("rejeita contexto duplicado e página sem contexto válido", () => {
  const pkg = buildThemePackage(v2());
  const duplicated = structuredClone(pkg);
  duplicated.theme.pages![1].context = "music";
  assert.throws(() => parseThemeFromJson(duplicated), /duplicado/);
  const invalid = structuredClone(pkg);
  invalid.theme.pages![0].context = "agenda" as never;
  assert.throws(() => parseThemeFromJson(invalid), /contexto/i);
});

test("backup usa v2", () => {
  const backup = buildThemesBackup([v2()]);
  assert.equal(backup.version, 2);
  assert.equal(backup.themes[0].pages?.length, 2);
});
