import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBibleVersionLabel,
  formatBibleVersionAbbrev,
  matchInstalledBibleVersion,
} from "./bibleUtils.ts";

test("formata nome e abreviação limpando Bibles_ e underscores", () => {
  const v = { id: "Bibles_ARA", name: "Bibles_ARA", abbrev: "Bibles_ARA", path: "" };
  assert.equal(formatBibleVersionAbbrev(v), "ARA");
  assert.equal(formatBibleVersionLabel(v), "Almeida Revista e Atualizada (ARA)");
});

test("formata versão NVI mantendo nome expandido", () => {
  const v = { id: "nvi", name: "NVI", abbrev: "NVI", path: "" };
  assert.equal(formatBibleVersionAbbrev(v), "NVI");
  assert.equal(formatBibleVersionLabel(v), "Nova Versão Internacional (NVI)");
});

test("reconhece versões instaladas por abbrev ou id", () => {
  const versions = [
    { id: "Bibles_ARA", name: "Bibles_ARA", abbrev: "Bibles_ARA", path: "" },
    { id: "Bibles_NVI", name: "Nova Versão Internacional", abbrev: "NVI", path: "" },
  ];

  assert.equal(matchInstalledBibleVersion(versions, "Ara")?.id, "Bibles_ARA");
  assert.equal(matchInstalledBibleVersion(versions, "ara")?.id, "Bibles_ARA");
  assert.equal(matchInstalledBibleVersion(versions, "NVI")?.id, "Bibles_NVI");
  assert.equal(matchInstalledBibleVersion(versions, "KJV"), null);
});
