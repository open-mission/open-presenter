import test from "node:test";
import assert from "node:assert/strict";
import {
  contextForSlide,
  contextForStage,
  resolveStageRenderTheme,
  resolveStageRestRenderTheme,
} from "./themeResolution.ts";
import type { SlideTheme, ThemeContext } from "@/core/types";

const page = (context: ThemeContext, label: string) => ({
  id: `p-${context}`,
  context,
  css: { background: label },
  elements: [],
});
const stageTheme = (guid: string, contexts: ThemeContext[]): SlideTheme => ({
  guid,
  title: guid,
  category: "stage",
  css: {},
  elements: [],
  pages: contexts.map((context) => page(context, `${guid}-${context}`)),
});

test("mapeia kind para contexto", () => {
  assert.equal(contextForSlide("lyric"), "music");
  assert.equal(contextForSlide("scripture"), "bible");
  assert.equal(contextForSlide("custom"), "text");
  assert.equal(contextForSlide("media", "text"), "text");
  assert.equal(contextForSlide("media", "image"), null);
  assert.equal(contextForSlide("blank"), null);
});

test("palco resolve a página pelo momento do conteúdo", () => {
  const theme = stageTheme("stage", ["rest", "music", "bible", "text"]);
  assert.equal(resolveStageRenderTheme(theme, "lyric")?.theme.css.background, "stage-music");
  assert.equal(resolveStageRenderTheme(theme, "scripture")?.theme.css.background, "stage-bible");
  assert.equal(resolveStageRenderTheme(theme, "custom")?.theme.css.background, "stage-text");
  assert.equal(resolveStageRenderTheme(theme, "blank")?.theme.css.background, "stage-rest");
  assert.equal(resolveStageRenderTheme(theme, "media", "image")?.asset, "rest");
  assert.equal(contextForStage("custom"), "text");
});

test("palco usa o descanso da página e cai no tema de descanso legado", () => {
  const theme = stageTheme("stage", ["rest"]);
  const legacy = stageTheme("legacy", ["music"]);
  assert.equal(resolveStageRestRenderTheme(theme, legacy).theme.css.background, "stage-rest");
  assert.equal(
    resolveStageRestRenderTheme(stageTheme("without-rest", ["music"]), legacy).theme.guid,
    "legacy",
  );
});

test("palco usa o modelo padrão quando a página do momento não existe", () => {
  const theme = stageTheme("partial", ["music"]);
  const fallback = stageTheme("fallback", ["bible", "text"]);
  assert.equal(
    resolveStageRenderTheme(theme, "scripture", null, fallback)?.theme.css.background,
    "fallback-bible",
  );
});
