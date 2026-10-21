import assert from "node:assert/strict";
import test from "node:test";
import { buildProps } from "./themeTemplate.ts";
import type { SlideContent } from "../../core/types/index.ts";

const lyric: SlideContent = {
  id: "s#0",
  kind: "lyric",
  title: "Título",
  lines: ["Linha"],
  section: "Verso",
};

test("hideText esvazia todos os props de texto", () => {
  const props = buildProps("lyric", lyric, null, { hideText: true });
  for (const value of Object.values(props)) {
    assert.equal(value, "");
  }
});

test("letra vazia não mostra título nem prévia do próximo", () => {
  const blank: SlideContent = {
    id: "s#empty-start",
    kind: "lyric",
    title: "",
    lines: [],
  };
  const props = buildProps("lyric", blank, lyric);
  assert.equal(props.title, "");
  assert.equal(props.lyrics, "");
  assert.equal(props.next_preview, "");
  assert.equal(props.next_line, "");
});
