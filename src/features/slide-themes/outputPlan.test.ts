import test from "node:test";
import assert from "node:assert/strict";
import {
  cssBackgroundLayer,
  fallbackPlanForOutput,
  isBackgroundCompatible,
  materializeThemeForContent,
  resolveContentTheme,
  resolveOutputBackground,
  resolveOutputPlan,
  resolveOutputTheme,
  resolveRestTheme,
  systemPlanForCategory,
  themeSupportsCategory,
} from "./outputPlan.ts";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_THEME,
  DEFAULT_STREAM_THEME,
  DEFAULT_STREAM_THEME_GUID,
} from "./seedThemes.ts";
import type {
  BackgroundLayer,
  DisplayOutput,
  MasterLayerId,
  SlideTheme,
  ThemeContext,
} from "@/core/types";

const page = (context: ThemeContext, label: string) => ({
  id: `p-${context}`,
  context,
  css: { background: label },
  elements: [],
});

const themed = (
  guid: string,
  category: string,
  contexts: ThemeContext[] = [],
  background = `bg-${guid}`,
): SlideTheme => ({
  guid,
  title: guid,
  category,
  css: { background },
  elements: [],
  pages: contexts.length ? contexts.map((c) => page(c, `bg-${guid}-${c}`)) : undefined,
});

const output = (patch: Partial<DisplayOutput> = {}): DisplayOutput => ({
  id: "out-1",
  name: "Saída",
  category: "public",
  type: "monitor",
  enabled: true,
  resolution: { width: 1920, height: 1080 },
  aspectRatio: "16:9",
  backgroundColor: "#000000",
  backgroundColorEnabled: true,
  frameRate: 60,
  videoDelayFrames: 0,
  alphaKey: false,
  ...patch,
});

test("compatibilidade de tema por categoria", () => {
  const publicTheme = themed("pub", "theme", ["music"]);
  const presentation = themed("pres", "presentation");
  const stage = themed("stg", "stage", ["music"]);
  const stream = themed("strm", "stream", ["music"]);

  assert.equal(themeSupportsCategory(publicTheme, "public"), true);
  assert.equal(themeSupportsCategory(presentation, "public"), true);
  assert.equal(themeSupportsCategory(stage, "public"), false);
  assert.equal(themeSupportsCategory(stream, "public"), false);

  assert.equal(themeSupportsCategory(stage, "stage"), true);
  assert.equal(themeSupportsCategory(publicTheme, "stage"), false);

  assert.equal(themeSupportsCategory(stream, "lower"), true);
  assert.equal(themeSupportsCategory(publicTheme, "lower"), false);
  assert.equal(
    themeSupportsCategory({ ...stream, guid: DEFAULT_STREAM_THEME_GUID }, "lower"),
    true,
  );
});

test("tema de conteúdo: deck vale em qualquer saída; lower só stream", () => {
  const presentation = themed("pres", "presentation");
  const publicTheme = themed("pub", "theme", ["music"]);
  const stream = themed("strm", "stream", ["music"]);
  const themes = [presentation, publicTheme, stream];

  assert.equal(resolveContentTheme("pres", themes, "public")?.guid, "pres");
  assert.equal(resolveContentTheme("pres", themes, "lower")?.guid, "pres");
  assert.equal(resolveContentTheme("pub", themes, "public")?.guid, "pub");
  assert.equal(resolveContentTheme("pub", themes, "lower"), null);
  assert.equal(resolveContentTheme("strm", themes, "lower")?.guid, "strm");
  assert.equal(resolveContentTheme(null, themes, "public"), null);
});

test("precedência de tema: override > evento > padrão > fallback", () => {
  const themes = [
    themed("override", "theme", ["music"]),
    themed("event", "theme", ["music"]),
    themed("default", "theme", ["music"]),
  ];
  const base = { category: "public" as const, themes };

  assert.equal(
    resolveOutputTheme({ ...base, overrideThemeGuid: "override", eventThemeGuid: "event", defaultThemeGuid: "default" }).source,
    "override",
  );
  assert.equal(
    resolveOutputTheme({ ...base, eventThemeGuid: "event", defaultThemeGuid: "default" }).source,
    "event",
  );
  assert.equal(resolveOutputTheme({ ...base, defaultThemeGuid: "default" }).source, "default");
  assert.equal(resolveOutputTheme(base).source, "fallback");
});

test("stage ignora o tema de evento", () => {
  const themes = [themed("event", "theme", ["music"]), DEFAULT_STAGE_THEME];
  const resolved = resolveOutputTheme({
    category: "stage",
    themes,
    eventThemeGuid: "event",
    defaultThemeGuid: DEFAULT_STAGE_THEME.guid,
  });
  assert.equal(resolved.source, "default");
});

test("override incompatível é ignorado", () => {
  const themes = [themed("strm", "stream", ["music"])];
  const resolved = resolveOutputTheme({ category: "public", themes, overrideThemeGuid: "strm" });
  assert.equal(resolved.source, "fallback");
});

test("compatibilidade de fundo: lower só aceita cor", () => {
  const color: BackgroundLayer = { id: "c", kind: "color", value: "#111" };
  const image: BackgroundLayer = { id: "i", kind: "image", value: "x.png" };
  assert.equal(isBackgroundCompatible("lower", color), true);
  assert.equal(isBackgroundCompatible("lower", image), false);
  assert.equal(isBackgroundCompatible("public", image), true);
  assert.equal(isBackgroundCompatible("stage", null), true);
});

test("precedência de fundo: conteúdo > override > slide > tema", () => {
  const contentTheme = themed("content", "theme", [], "bg-content");
  const theme = themed("theme", "theme", [], "bg-theme");
  const override: BackgroundLayer = { id: "ov", kind: "color", value: "#0f0" };
  const live: BackgroundLayer = { id: "live", kind: "image", value: "live.png" };

  assert.equal(
    resolveOutputBackground({ category: "public", contentTheme, overrideBackground: override, liveBackground: live, theme })?.value,
    "bg-content",
  );
  assert.equal(
    resolveOutputBackground({ category: "public", overrideBackground: override, liveBackground: live, theme })?.id,
    "ov",
  );
  assert.equal(
    resolveOutputBackground({ category: "public", liveBackground: live, theme })?.id,
    "live",
  );
  assert.equal(
    resolveOutputBackground({ category: "public", theme })?.value,
    "bg-theme",
  );
  assert.equal(resolveOutputBackground({ category: "public" }), null);
});

test("override de fundo incompatível no lower é descartado", () => {
  const image: BackgroundLayer = { id: "i", kind: "image", value: "x.png" };
  const theme = themed("theme", "stream", [], "bg-theme");
  assert.equal(
    resolveOutputBackground({ category: "lower", overrideBackground: image, theme })?.value,
    "bg-theme",
  );
});

test("materializeThemeForContent escolhe a página do contexto e o deck pelo índice", () => {
  const theme = themed("t", "theme", ["music", "bible"]);
  assert.equal(
    materializeThemeForContent(theme, { id: "s", kind: "scripture", title: "", lines: [] })?.css.background,
    "bg-t-bible",
  );
  const deck = themed("deck", "presentation", ["music", "bible"]);
  assert.equal(
    materializeThemeForContent(deck, {
      id: "s",
      kind: "media",
      title: "",
      lines: [],
      media: { kind: "image", title: "m", index: 1 },
    })?.css.background,
    "bg-deck-bible",
  );
});

test("resolveOutputPlan monta tema, look, cor de tela e descanso do stage", () => {
  const stage = themed("stg", "stage", ["music"]);
  const rest = themed("rest", "stage", ["rest"]);
  const plan = resolveOutputPlan({
    output: output({
      id: "stage-1",
      category: "stage",
      defaultThemeGuid: "stg",
      idleThemeGuid: "rest",
      backgroundColor: "#123456",
      backgroundColorEnabled: false,
    }),
    themes: [stage, rest],
    now: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(plan.outputId, "stage-1");
  assert.equal(plan.theme?.guid, "stg");
  assert.equal(plan.themeSource, "default");
  assert.equal(plan.restTheme?.guid, "rest");
  assert.equal(plan.look.screenColor, false);
  assert.deepEqual(plan.screenColor, { enabled: false, value: "#123456" });
  assert.equal(plan.updatedAt, "2026-01-01T00:00:00.000Z");
});

test("tema de descanso: idle vence a página rest; sem idle usa a página; senão o padrão", () => {
  const withRest = themed("active", "stage", ["music", "rest"]);
  const idle = themed("idle", "stage", ["rest"]);
  assert.equal(resolveRestTheme({ themes: [withRest, idle], idleThemeGuid: "idle", activeTheme: withRest }).guid, "idle");
  assert.equal(resolveRestTheme({ themes: [withRest], activeTheme: withRest }).guid, "active");
  assert.equal(resolveRestTheme({ themes: [], activeTheme: themed("no-rest", "stage", ["music"]) }).guid, DEFAULT_STAGE_REST_THEME.guid);
});

test("fallback e plano de sistema usam o tema padrão da categoria", () => {
  const fallback = fallbackPlanForOutput(output(), [], "now");
  assert.equal(fallback.themeSource, "fallback");
  assert.equal(fallback.theme?.guid, DEFAULT_PUBLIC_THEME.guid);
  assert.equal(fallback.look.slide, true);

  const lowerSystem = systemPlanForCategory("lower", [], "now");
  assert.equal(lowerSystem.category, "lower");
  assert.equal(lowerSystem.screenColor.enabled, false);
  assert.equal(lowerSystem.look.screenColor, false);
  assert.equal(lowerSystem.look.props, false);
});

test("cssBackgroundLayer detecta ISF", () => {
  assert.equal(cssBackgroundLayer("#000", "x").kind, "css");
  assert.equal(cssBackgroundLayer("isf:plasma", "x").kind, "isf");
});

test("default de tema para cada categoria", () => {
  assert.equal(fallbackPlanForOutput(output({ category: "stage" }), [], "n").theme?.guid, DEFAULT_STAGE_THEME.guid);
  assert.equal(fallbackPlanForOutput(output({ category: "lower" }), [], "n").theme?.guid, DEFAULT_STREAM_THEME.guid);
});
