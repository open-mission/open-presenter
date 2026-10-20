import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_UI_THEME,
  PRESETS,
  TOKEN_DEFINITIONS,
  UI_THEME_STORAGE_KEY,
  applyUiTheme,
  clearUiTheme,
  findPreset,
  loadUiTheme,
  parseUiThemeCss,
  parseUiThemeFile,
  parseUiThemeJson,
  saveUiTheme,
  serializeUiThemeCss,
  serializeUiThemeJson,
  themeCssVariables,
  type UiTheme,
} from "./uiTheme.ts";

function allTokens(theme: UiTheme): void {
  for (const token of TOKEN_DEFINITIONS) {
    assert.match(theme.light[token.key], /.+/);
    assert.match(theme.dark[token.key], /.+/);
  }
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function fakeRoot() {
  const values = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const root = {
    values,
    dataset,
    style: {
      setProperty: (key: string, value: string) => values.set(key, value),
      removeProperty: (key: string) => values.delete(key),
    },
  } as unknown as HTMLElement;
  return root;
}

test("as definições cobrem todos os tokens e têm variáveis CSS únicas", () => {
  assert.ok(TOKEN_DEFINITIONS.length >= 30);
  const cssVars = new Set(TOKEN_DEFINITIONS.map((token) => token.cssVar));
  const keys = new Set(TOKEN_DEFINITIONS.map((token) => token.key));
  assert.equal(cssVars.size, TOKEN_DEFINITIONS.length);
  assert.equal(keys.size, TOKEN_DEFINITIONS.length);
  allTokens(DEFAULT_UI_THEME);
});

test("o tema padrão e todos os presets estão completos", () => {
  assert.equal(DEFAULT_UI_THEME.presetId, "open-presenter");
  assert.equal(DEFAULT_UI_THEME.radius, "0.625rem");
  assert.ok(PRESETS.length >= 8);

  for (const preset of PRESETS) {
    assert.equal(preset.theme.presetId, preset.id);
    assert.ok(preset.theme.name.length > 0);
    allTokens(preset.theme);
  }

  assert.equal(findPreset("blue")?.name, "Azul");
  assert.equal(findPreset("missing"), undefined);
});

test("serializa e interpreta JSON preservando o tema", () => {
  const json = serializeUiThemeJson(DEFAULT_UI_THEME);
  const parsed = parseUiThemeJson(json);
  assert.deepEqual(parsed, DEFAULT_UI_THEME);
});

test("rejeita JSON inválido, formato desconhecido e paleta ausente", () => {
  assert.throws(() => parseUiThemeJson("{"), /JSON inválido/i);
  assert.throws(
    () => parseUiThemeJson(JSON.stringify({ format: "outro", version: 1 })),
    /formato/i,
  );
  assert.throws(
    () =>
      parseUiThemeJson(
        JSON.stringify({
          format: "open-presenter-ui-theme",
          version: 99,
          light: {},
          dark: {},
        }),
      ),
    /versão/i,
  );
  assert.throws(
    () =>
      parseUiThemeJson(
        JSON.stringify({
          format: "open-presenter-ui-theme",
          version: 1,
          light: DEFAULT_UI_THEME.light,
        }),
      ),
    /paletas/i,
  );
});

test("importa JSON parcial completando com o tema padrão", () => {
  const parsed = parseUiThemeJson(
    JSON.stringify({
      format: "open-presenter-ui-theme",
      version: 1,
      name: "Meu tema",
      light: { primary: "#ff0000" },
      dark: { primary: "#00ff00" },
    }),
  );

  assert.equal(parsed.name, "Meu tema");
  assert.equal(parsed.light.primary, "#ff0000");
  assert.equal(parsed.light.background, DEFAULT_UI_THEME.light.background);
  assert.equal(parsed.dark.primary, "#00ff00");
  assert.equal(parsed.dark.background, DEFAULT_UI_THEME.dark.background);
});

test("rejeita valores de cor vazios ou perigosos", () => {
  assert.throws(
    () =>
      parseUiThemeJson(
        JSON.stringify({
          format: "open-presenter-ui-theme",
          version: 1,
          light: { primary: "" },
          dark: {},
        }),
      ),
    /cor/i,
  );
  assert.throws(
    () =>
      parseUiThemeJson(
        JSON.stringify({
          format: "open-presenter-ui-theme",
          version: 1,
          light: { primary: "#fff; } body { display: none" },
          dark: {},
        }),
      ),
    /cor/i,
  );
});

test("serializa CSS com blocos claro e escuro e todas as variáveis", () => {
  const css = serializeUiThemeCss(DEFAULT_UI_THEME);
  assert.match(css, /:root\s*\{/);
  assert.match(css, /\.dark\s*\{/);
  assert.match(css, /--background:/);
  assert.match(css, /--primary:/);
  assert.match(css, /--sidebar-ring:/);
  assert.match(css, /--radius:\s*0\.625rem;/);
});

test("interpreta CSS completo e preserva as paletas", () => {
  const parsed = parseUiThemeCss(serializeUiThemeCss(DEFAULT_UI_THEME));
  assert.deepEqual(parsed.light, DEFAULT_UI_THEME.light);
  assert.deepEqual(parsed.dark, DEFAULT_UI_THEME.dark);
  assert.equal(parsed.radius, DEFAULT_UI_THEME.radius);
});

test("interpreta CSS parcial e usa o tema padrão no que faltar", () => {
  const parsed = parseUiThemeCss(`
    :root { --primary: #ff0000; }
    .dark { --primary: #00ff00; }
  `);
  assert.equal(parsed.light.primary, "#ff0000");
  assert.equal(parsed.light.background, DEFAULT_UI_THEME.light.background);
  assert.equal(parsed.dark.primary, "#00ff00");
  assert.equal(parsed.dark.background, DEFAULT_UI_THEME.dark.background);
});

test("rejeita CSS sem bloco :root", () => {
  assert.throws(() => parseUiThemeCss(".dark { --primary: #fff; }"), /:root/i);
});

test("detecta automaticamente JSON ou CSS", () => {
  const fromJson = parseUiThemeFile(serializeUiThemeJson(DEFAULT_UI_THEME));
  assert.equal(fromJson.presetId, DEFAULT_UI_THEME.presetId);

  const fromCss = parseUiThemeFile(serializeUiThemeCss(DEFAULT_UI_THEME));
  assert.deepEqual(fromCss.light, DEFAULT_UI_THEME.light);
});

test("gera variáveis CSS para o modo ativo", () => {
  const light = themeCssVariables(DEFAULT_UI_THEME, "light");
  assert.equal(light["--primary"], DEFAULT_UI_THEME.light.primary);
  assert.equal(light["--card-foreground"], DEFAULT_UI_THEME.light.cardForeground);
  assert.equal(light["--radius"], DEFAULT_UI_THEME.radius);

  const dark = themeCssVariables(DEFAULT_UI_THEME, "dark");
  assert.equal(dark["--primary"], DEFAULT_UI_THEME.dark.primary);
});

test("aplica e limpa as variáveis no elemento raiz", () => {
  const root = fakeRoot();
  applyUiTheme(DEFAULT_UI_THEME, "dark", root);

  const values = (root as unknown as { values: Map<string, string> }).values;
  assert.equal(values.get("--primary"), DEFAULT_UI_THEME.dark.primary);
  assert.equal(values.get("--radius"), DEFAULT_UI_THEME.radius);
  assert.equal(root.dataset.uiTheme, "open-presenter");
  assert.equal(root.dataset.uiThemeMode, "dark");

  clearUiTheme(root);
  assert.equal(values.size, 0);
  assert.equal(root.dataset.uiTheme, undefined);
  assert.equal(root.dataset.uiThemeMode, undefined);
});

test("persiste e recupera o tema do armazenamento", () => {
  const storage = memoryStorage();
  saveUiTheme(DEFAULT_UI_THEME, storage);
  assert.ok(storage.getItem(UI_THEME_STORAGE_KEY));
  assert.deepEqual(loadUiTheme(storage), DEFAULT_UI_THEME);
});

test("usa o tema padrão quando o armazenamento está vazio ou corrompido", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadUiTheme(storage), DEFAULT_UI_THEME);
  storage.setItem(UI_THEME_STORAGE_KEY, "{quebrado");
  assert.deepEqual(loadUiTheme(storage), DEFAULT_UI_THEME);
});
