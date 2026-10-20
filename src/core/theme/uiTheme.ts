import { contrastColor, mixHex } from "./color.ts";

export const UI_THEME_FORMAT = "open-presenter-ui-theme";
export const UI_THEME_VERSION = 1;
export const UI_THEME_STORAGE_KEY = "open_presenter_ui_theme";

export type UiThemeMode = "light" | "dark";

export type UiThemeTokenGroup =
  | "base"
  | "surface"
  | "action"
  | "feedback"
  | "charts"
  | "sidebar";

export type UiThemeTokenKey =
  | "background"
  | "foreground"
  | "card"
  | "cardForeground"
  | "popover"
  | "popoverForeground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "destructive"
  | "border"
  | "input"
  | "ring"
  | "chart1"
  | "chart2"
  | "chart3"
  | "chart4"
  | "chart5"
  | "sidebar"
  | "sidebarForeground"
  | "sidebarPrimary"
  | "sidebarPrimaryForeground"
  | "sidebarAccent"
  | "sidebarAccentForeground"
  | "sidebarBorder"
  | "sidebarRing";

export type UiThemePalette = Record<UiThemeTokenKey, string>;

export interface UiThemeTokenDefinition {
  key: UiThemeTokenKey;
  cssVar: `--${string}`;
  label: string;
  group: UiThemeTokenGroup;
}

export interface UiTheme {
  version: 1;
  name: string;
  presetId: string | null;
  radius: string;
  light: UiThemePalette;
  dark: UiThemePalette;
}

export interface UiThemePreset {
  id: string;
  name: string;
  description: string;
  theme: UiTheme;
}

export const TOKEN_DEFINITIONS: readonly UiThemeTokenDefinition[] = [
  { key: "background", cssVar: "--background", label: "Fundo", group: "base" },
  { key: "foreground", cssVar: "--foreground", label: "Texto", group: "base" },
  { key: "card", cssVar: "--card", label: "Cartão", group: "surface" },
  {
    key: "cardForeground",
    cssVar: "--card-foreground",
    label: "Texto do cartão",
    group: "surface",
  },
  { key: "popover", cssVar: "--popover", label: "Popover", group: "surface" },
  {
    key: "popoverForeground",
    cssVar: "--popover-foreground",
    label: "Texto do popover",
    group: "surface",
  },
  { key: "primary", cssVar: "--primary", label: "Primária", group: "action" },
  {
    key: "primaryForeground",
    cssVar: "--primary-foreground",
    label: "Texto da primária",
    group: "action",
  },
  {
    key: "secondary",
    cssVar: "--secondary",
    label: "Secundária",
    group: "action",
  },
  {
    key: "secondaryForeground",
    cssVar: "--secondary-foreground",
    label: "Texto da secundária",
    group: "action",
  },
  { key: "muted", cssVar: "--muted", label: "Suave", group: "action" },
  {
    key: "mutedForeground",
    cssVar: "--muted-foreground",
    label: "Texto suave",
    group: "action",
  },
  { key: "accent", cssVar: "--accent", label: "Destaque", group: "action" },
  {
    key: "accentForeground",
    cssVar: "--accent-foreground",
    label: "Texto do destaque",
    group: "action",
  },
  {
    key: "destructive",
    cssVar: "--destructive",
    label: "Destrutiva",
    group: "action",
  },
  { key: "border", cssVar: "--border", label: "Borda", group: "feedback" },
  { key: "input", cssVar: "--input", label: "Campo", group: "feedback" },
  { key: "ring", cssVar: "--ring", label: "Anel de foco", group: "feedback" },
  { key: "chart1", cssVar: "--chart-1", label: "Gráfico 1", group: "charts" },
  { key: "chart2", cssVar: "--chart-2", label: "Gráfico 2", group: "charts" },
  { key: "chart3", cssVar: "--chart-3", label: "Gráfico 3", group: "charts" },
  { key: "chart4", cssVar: "--chart-4", label: "Gráfico 4", group: "charts" },
  { key: "chart5", cssVar: "--chart-5", label: "Gráfico 5", group: "charts" },
  {
    key: "sidebar",
    cssVar: "--sidebar",
    label: "Barra lateral",
    group: "sidebar",
  },
  {
    key: "sidebarForeground",
    cssVar: "--sidebar-foreground",
    label: "Texto da barra lateral",
    group: "sidebar",
  },
  {
    key: "sidebarPrimary",
    cssVar: "--sidebar-primary",
    label: "Primária da barra lateral",
    group: "sidebar",
  },
  {
    key: "sidebarPrimaryForeground",
    cssVar: "--sidebar-primary-foreground",
    label: "Texto da primária lateral",
    group: "sidebar",
  },
  {
    key: "sidebarAccent",
    cssVar: "--sidebar-accent",
    label: "Destaque da barra lateral",
    group: "sidebar",
  },
  {
    key: "sidebarAccentForeground",
    cssVar: "--sidebar-accent-foreground",
    label: "Texto do destaque lateral",
    group: "sidebar",
  },
  {
    key: "sidebarBorder",
    cssVar: "--sidebar-border",
    label: "Borda da barra lateral",
    group: "sidebar",
  },
  {
    key: "sidebarRing",
    cssVar: "--sidebar-ring",
    label: "Anel da barra lateral",
    group: "sidebar",
  },
] as const;

const CSS_VAR_TO_KEY = new Map<string, UiThemeTokenKey>(
  TOKEN_DEFINITIONS.map((token) => [token.cssVar, token.key]),
);

const DEFAULT_LIGHT = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  popover: "#ffffff",
  popoverForeground: "#0a0a0a",
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f5f5f5",
  secondaryForeground: "#171717",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  accent: "#f5f5f5",
  accentForeground: "#171717",
  destructive: "#e7000b",
  border: "#e5e5e5",
  input: "#e5e5e5",
  ring: "#a1a1a1",
  chart1: "#dedede",
  chart2: "#a1a1a1",
  chart3: "#737373",
  chart4: "#525252",
  chart5: "#262626",
  sidebar: "#fafafa",
  sidebarForeground: "#0a0a0a",
  sidebarPrimary: "#171717",
  sidebarPrimaryForeground: "#fafafa",
  sidebarAccent: "#f5f5f5",
  sidebarAccentForeground: "#171717",
  sidebarBorder: "#e5e5e5",
  sidebarRing: "#a1a1a1",
} satisfies UiThemePalette;

const DEFAULT_DARK = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  card: "#171717",
  cardForeground: "#fafafa",
  popover: "#171717",
  popoverForeground: "#fafafa",
  primary: "#e5e5e5",
  primaryForeground: "#171717",
  secondary: "#262626",
  secondaryForeground: "#fafafa",
  muted: "#262626",
  mutedForeground: "#a1a1a1",
  accent: "#262626",
  accentForeground: "#fafafa",
  destructive: "#ff6467",
  border: "#262626",
  input: "#2e2e2e",
  ring: "#737373",
  chart1: "#dedede",
  chart2: "#a1a1a1",
  chart3: "#737373",
  chart4: "#525252",
  chart5: "#262626",
  sidebar: "#171717",
  sidebarForeground: "#fafafa",
  sidebarPrimary: "#e5e5e5",
  sidebarPrimaryForeground: "#171717",
  sidebarAccent: "#262626",
  sidebarAccentForeground: "#fafafa",
  sidebarBorder: "#262626",
  sidebarRing: "#737373",
} satisfies UiThemePalette;

export const DEFAULT_UI_THEME: UiTheme = {
  version: 1,
  name: "Open Presenter",
  presetId: "open-presenter",
  radius: "0.625rem",
  light: DEFAULT_LIGHT,
  dark: DEFAULT_DARK,
};

function buildPreset(
  id: string,
  name: string,
  description: string,
  lightPrimary: string,
  darkPrimary: string,
  radius = DEFAULT_UI_THEME.radius,
  overrides?: {
    light?: Partial<UiThemePalette>;
    dark?: Partial<UiThemePalette>;
  },
): UiThemePreset {
  const lightAccent = mixHex(lightPrimary, "#ffffff", 0.92);
  const darkAccent = mixHex(darkPrimary, "#0a0a0a", 0.85);

  const light: UiThemePalette = {
    ...DEFAULT_UI_THEME.light,
    primary: lightPrimary,
    primaryForeground: contrastColor(lightPrimary),
    accent: lightAccent,
    accentForeground: contrastColor(lightAccent),
    ring: lightPrimary,
    sidebarPrimary: lightPrimary,
    sidebarPrimaryForeground: contrastColor(lightPrimary),
    sidebarAccent: lightAccent,
    sidebarAccentForeground: contrastColor(lightAccent),
    chart1: lightPrimary,
    ...overrides?.light,
  };

  const dark: UiThemePalette = {
    ...DEFAULT_UI_THEME.dark,
    primary: darkPrimary,
    primaryForeground: contrastColor(darkPrimary),
    accent: darkAccent,
    accentForeground: contrastColor(darkAccent),
    ring: darkPrimary,
    sidebarPrimary: darkPrimary,
    sidebarPrimaryForeground: contrastColor(darkPrimary),
    sidebarAccent: darkAccent,
    sidebarAccentForeground: contrastColor(darkAccent),
    chart1: darkPrimary,
    ...overrides?.dark,
  };

  return {
    id,
    name,
    description,
    theme: { version: 1, name, presetId: id, radius, light, dark },
  };
}

export const PRESETS: readonly UiThemePreset[] = [
  {
    id: "open-presenter",
    name: "Open Presenter",
    description: "Neutro, direto e fiel à identidade do projeto.",
    theme: DEFAULT_UI_THEME,
  },
  buildPreset(
    "slate",
    "Slate",
    "Cinza azulado, discreto e confortável para longas operações.",
    "#0f172a",
    "#e2e8f0",
  ),
  buildPreset(
    "blue",
    "Azul",
    "Azul clássico para destacar ações e o status ao vivo.",
    "#2563eb",
    "#60a5fa",
  ),
  buildPreset(
    "violet",
    "Violeta",
    "Um roxo profundo com contraste suave.",
    "#7c3aed",
    "#a78bfa",
  ),
  buildPreset(
    "green",
    "Verde",
    "Verde natural, associado a confirmação e disponibilidade.",
    "#16a34a",
    "#4ade80",
  ),
  buildPreset(
    "amber",
    "Âmbar",
    "Quente e acolhedor, com boa leitura em ambientes claros.",
    "#d97706",
    "#fbbf24",
  ),
  buildPreset(
    "rose",
    "Rosa",
    "Um acento vibrante para quem quer uma interface mais marcante.",
    "#e11d48",
    "#fb7185",
  ),
  buildPreset(
    "contrast",
    "Alto contraste",
    "Preto e branco com bordas fortes para máxima legibilidade.",
    "#000000",
    "#ffffff",
    "0.25rem",
    {
      light: {
        border: "#000000",
        input: "#000000",
        ring: "#000000",
        sidebarBorder: "#000000",
        sidebarRing: "#000000",
      },
      dark: {
        border: "#ffffff",
        input: "#ffffff",
        ring: "#ffffff",
        sidebarBorder: "#ffffff",
        sidebarRing: "#ffffff",
      },
    },
  ),
];

export function findPreset(id: string): UiThemePreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

export function cloneUiTheme(theme: UiTheme): UiTheme {
  return {
    ...theme,
    light: { ...theme.light },
    dark: { ...theme.dark },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeCssColor(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`Cor inválida em ${path}.`);
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    /[;{}]/.test(trimmed) ||
    /url\s*\(|expression\s*\(|javascript:|@import/i.test(trimmed)
  ) {
    throw new Error(`Cor inválida em ${path}.`);
  }

  return trimmed;
}

function isSafeRadius(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !/[;{}]/.test(value) &&
    /^(0|\d*\.?\d+)(px|rem|em)?$/.test(value.trim())
  );
}

function parsePalette(
  input: unknown,
  fallback: UiThemePalette,
  path: string,
): UiThemePalette {
  if (!isRecord(input)) {
    throw new Error(`A paleta ${path} é inválida.`);
  }

  const palette: UiThemePalette = { ...fallback };
  for (const token of TOKEN_DEFINITIONS) {
    const value = input[token.key];
    if (value !== undefined) {
      palette[token.key] = safeCssColor(value, `${path}.${token.key}`);
    }
  }
  return palette;
}

export function serializeUiThemeJson(theme: UiTheme): string {
  return JSON.stringify(
    {
      format: UI_THEME_FORMAT,
      version: UI_THEME_VERSION,
      name: theme.name,
      presetId: theme.presetId,
      radius: theme.radius,
      light: theme.light,
      dark: theme.dark,
    },
    null,
    2,
  );
}

export function parseUiThemeJson(text: string): UiTheme {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Arquivo JSON inválido.");
  }

  if (!isRecord(data)) {
    throw new Error("Formato de tema inválido.");
  }
  if (data.format !== UI_THEME_FORMAT) {
    throw new Error("Formato de tema inválido.");
  }
  if (data.version !== UI_THEME_VERSION) {
    throw new Error("Versão de tema não suportada.");
  }
  if (!isRecord(data.light) || !isRecord(data.dark)) {
    throw new Error("O tema precisa das paletas clara e escura.");
  }

  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : "Tema importado";
  const presetId =
    typeof data.presetId === "string" && data.presetId.trim().length > 0
      ? data.presetId
      : null;
  const radius = isSafeRadius(data.radius)
    ? data.radius.trim()
    : DEFAULT_UI_THEME.radius;

  return {
    version: 1,
    name,
    presetId,
    radius,
    light: parsePalette(data.light, DEFAULT_UI_THEME.light, "clara"),
    dark: parsePalette(data.dark, DEFAULT_UI_THEME.dark, "escura"),
  };
}

function extractBlock(source: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "i").exec(source);
  return match?.[1] ?? null;
}

function parseDeclarations(block: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  const pattern = /--([\w-]+)\s*:\s*([^;{}]+)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) {
    declarations[`--${match[1]}`] = match[2].trim();
  }
  return declarations;
}

function declarationsToPalette(
  declarations: Record<string, string>,
  fallback: UiThemePalette,
  path: string,
): UiThemePalette {
  const palette: UiThemePalette = { ...fallback };
  for (const [cssVar, value] of Object.entries(declarations)) {
    const key = CSS_VAR_TO_KEY.get(cssVar);
    if (key) {
      palette[key] = safeCssColor(value, `${path}.${key}`);
    }
  }
  return palette;
}

export function serializeUiThemeCss(theme: UiTheme): string {
  const declarations = (palette: UiThemePalette) =>
    TOKEN_DEFINITIONS.map(
      (token) => `  ${token.cssVar}: ${palette[token.key]};`,
    ).join("\n");

  return `/* Open Presenter UI Theme: ${theme.name} */\n:root {\n${declarations(
    theme.light,
  )}\n  --radius: ${theme.radius};\n}\n\n.dark {\n${declarations(theme.dark)}\n}\n`;
}

export function parseUiThemeCss(text: string): UiTheme {
  const rootBlock = extractBlock(text, ":root");
  if (!rootBlock) {
    throw new Error("O CSS precisa de um bloco :root.");
  }

  const rootDeclarations = parseDeclarations(rootBlock);
  const darkBlock = extractBlock(text, ".dark");
  const darkDeclarations = darkBlock ? parseDeclarations(darkBlock) : {};

  const nameMatch = /\/\*\s*Open Presenter UI Theme:\s*(.*?)\s*\*\//i.exec(text);
  const name = nameMatch?.[1]?.trim() || "Tema importado";
  const radius = isSafeRadius(rootDeclarations["--radius"])
    ? rootDeclarations["--radius"].trim()
    : DEFAULT_UI_THEME.radius;

  return {
    version: 1,
    name,
    presetId: null,
    radius,
    light: declarationsToPalette(
      rootDeclarations,
      DEFAULT_UI_THEME.light,
      "clara",
    ),
    dark: declarationsToPalette(
      darkDeclarations,
      DEFAULT_UI_THEME.dark,
      "escura",
    ),
  };
}

export function parseUiThemeFile(text: string): UiTheme {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return parseUiThemeJson(trimmed);
  }
  return parseUiThemeCss(trimmed);
}

export function themeCssVariables(
  theme: UiTheme,
  mode: UiThemeMode,
): Record<string, string> {
  const palette = mode === "dark" ? theme.dark : theme.light;
  const variables: Record<string, string> = {};
  for (const token of TOKEN_DEFINITIONS) {
    variables[token.cssVar] = palette[token.key];
  }
  variables["--radius"] = theme.radius;
  return variables;
}

function documentRoot(): HTMLElement | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement;
}

function localStorageOrNull(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function getCurrentUiMode(): UiThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyUiTheme(
  theme: UiTheme,
  mode: UiThemeMode,
  root: HTMLElement | undefined = documentRoot(),
): void {
  if (!root) return;

  for (const [name, value] of Object.entries(themeCssVariables(theme, mode))) {
    root.style.setProperty(name, value);
  }
  root.dataset.uiTheme = theme.presetId ?? "custom";
  root.dataset.uiThemeMode = mode;
}

export function clearUiTheme(root: HTMLElement | undefined = documentRoot()): void {
  if (!root) return;

  for (const token of TOKEN_DEFINITIONS) {
    root.style.removeProperty(token.cssVar);
  }
  root.style.removeProperty("--radius");
  delete root.dataset.uiTheme;
  delete root.dataset.uiThemeMode;
}

export function loadUiTheme(storage: Storage | null = localStorageOrNull()): UiTheme {
  if (!storage) return cloneUiTheme(DEFAULT_UI_THEME);

  try {
    const raw = storage.getItem(UI_THEME_STORAGE_KEY);
    if (!raw) return cloneUiTheme(DEFAULT_UI_THEME);
    return parseUiThemeJson(raw);
  } catch {
    return cloneUiTheme(DEFAULT_UI_THEME);
  }
}

export function saveUiTheme(
  theme: UiTheme,
  storage: Storage | null = localStorageOrNull(),
): void {
  if (!storage) return;
  try {
    storage.setItem(UI_THEME_STORAGE_KEY, serializeUiThemeJson(theme));
  } catch {}
}

export function applyStoredUiTheme(mode: UiThemeMode = getCurrentUiMode()): void {
  applyUiTheme(loadUiTheme(), mode);
}

export function initUiThemeStorageSync(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("storage", (event) => {
    if (event.key === UI_THEME_STORAGE_KEY) {
      applyStoredUiTheme();
    }
  });
}
