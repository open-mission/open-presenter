import test from "node:test";
import assert from "node:assert/strict";
import {
  contextForSlide,
  contextForStage,
  resolveLiveTheme,
  resolveStageRenderTheme,
  resolveStageRestRenderTheme,
} from "./themeResolution.ts";
import type { SlideTheme, ThemeBinding, ThemeContext } from "@/core/types";

const page = (context: ThemeContext, label: string) => ({
  id: `p-${context}`,
  context,
  css: { background: label },
  elements: [],
});
const publicTheme = (guid: string, contexts: ("music" | "bible" | "text")[]): SlideTheme => ({
  guid,
  title: guid,
  category: "theme",
  css: {},
  elements: [],
  pages: contexts.map((context) => page(context, guid)),
});
const stageTheme = (guid: string, contexts: ThemeContext[]): SlideTheme => ({
  guid,
  title: guid,
  category: "stage",
  css: {},
  elements: [],
  pages: contexts.map((context) => page(context, `${guid}-${context}`)),
});
const v1 = (guid: string, label: string): SlideTheme => ({
  guid,
  title: guid,
  category: "theme",
  css: { background: label },
  elements: [],
});
const binding = (asset: "lyric" | "scripture" | "custom", guid: string): ThemeBinding => ({
  target: "public",
  asset,
  themeGuid: guid,
});

test("evento vence vínculo e padrão", () => {
  const event = publicTheme("event", ["music"]);
  const bound = publicTheme("bound", ["music"]);
  const def = publicTheme("default", ["music"]);
  const result = resolveLiveTheme({
    kind: "lyric",
    eventThemeGuid: "event",
    themes: [event, bound, def],
    bindings: [binding("lyric", "bound")],
    defaultTheme: def,
  });
  assert.equal(result?.pages?.[0].context, "music");
  assert.equal(result?.css.background, "event");
});

test("contexto ausente no evento cai no vínculo e depois no padrão", () => {
  const event = publicTheme("event", ["music"]);
  const bound = publicTheme("bound", ["bible"]);
  const def = publicTheme("default", ["text"]);
  const themes = [event, bound, def];
  const bindings = [binding("scripture", "bound")];
  const eventResult = resolveLiveTheme({
    kind: "scripture",
    eventThemeGuid: "event",
    themes,
    bindings,
    defaultTheme: def,
  });
  assert.equal(eventResult?.css.background, "bound");
  const defaultResult = resolveLiveTheme({
    kind: "custom",
    eventThemeGuid: "event",
    themes,
    bindings,
    defaultTheme: def,
  });
  assert.equal(defaultResult?.css.background, "default");
});

test("tema v1 é universal", () => {
  const legacy = v1("legacy", "#111");
  const def = publicTheme("default", ["music"]);
  const result = resolveLiveTheme({
    kind: "scripture",
    eventThemeGuid: "legacy",
    themes: [legacy, def],
    bindings: [],
    defaultTheme: def,
  });
  assert.equal(result?.guid, "legacy");
});

test("apresentação usa layout único e não sofre fallback", () => {
  const presentation: SlideTheme = {
    guid: "pres",
    title: "Pres",
    category: "presentation",
    css: { background: "#abc" },
    elements: [],
  };
  const result = resolveLiveTheme({
    kind: "media",
    mediaThemeId: "pres",
    themes: [presentation],
    bindings: [],
    defaultTheme: null,
  });
  assert.equal(result?.guid, "pres");
});

test("mídia com páginas usa página de texto; imagem e blank não recebem tema", () => {
  const pages = publicTheme("pages", ["text"]);
  const text = resolveLiveTheme({
    kind: "media",
    mediaKind: "text",
    mediaThemeId: "pages",
    themes: [pages],
    bindings: [],
    defaultTheme: null,
  });
  assert.equal(text?.css.background, "pages");
  const image = resolveLiveTheme({
    kind: "media",
    mediaKind: "image",
    mediaThemeId: "pages",
    themes: [pages],
    bindings: [],
    defaultTheme: null,
  });
  assert.equal(image, null);
  const blank = resolveLiveTheme({
    kind: "blank",
    themes: [pages],
    bindings: [],
    defaultTheme: pages,
  });
  assert.equal(blank, null);
});

test("ignora tema de palco em vínculo público", () => {
  const single: SlideTheme = {
    guid: "stage",
    title: "Stage",
    category: "stage",
    css: {},
    elements: [],
  };
  const result = resolveLiveTheme({
    kind: "lyric",
    themes: [single],
    bindings: [binding("lyric", "stage")],
    defaultTheme: null,
  });
  assert.equal(result, null);

  const pages = stageTheme("stage-pages", ["music"]);
  const resultPages = resolveLiveTheme({
    kind: "lyric",
    themes: [pages],
    bindings: [binding("lyric", "stage-pages")],
    defaultTheme: null,
  });
  assert.equal(resultPages, null);
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

test("saída de transmissão (stream) resolve tema vinculado especificamente para stream", () => {
  const publicThemeItem = publicTheme("pub-1", ["music"]);
  const streamLowerThird = publicTheme("stream-lower-third", ["music"]);
  const bindings: ThemeBinding[] = [
    { target: "public", asset: "lyric", themeGuid: "pub-1" },
    { target: "stream", asset: "lyric", themeGuid: "stream-lower-third" },
  ];

  const resolved = resolveLiveTheme({
    kind: "lyric",
    themes: [publicThemeItem, streamLowerThird],
    bindings,
    target: "stream",
  });

  assert.equal(resolved?.guid, "stream-lower-third");
});
