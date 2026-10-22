import type {
  SlideTheme,
  ThemeContext,
  ThemeElement,
  ThemeGuide,
  ThemePage,
} from "@/core/types";

export const THEME_PACKAGE_VERSION = 2;
export const THEME_CONTEXTS: readonly ThemeContext[] = [
  "rest",
  "music",
  "bible",
  "text",
];

export interface ThemePackageV2 {
  $schema?: string;
  format: "open-presenter-theme";
  version: 2;
  exportedAt: string;
  theme: SlideTheme;
}

export interface ThemesBackupPackageV2 {
  $schema?: string;
  format: "open-presenter-themes-backup";
  version: 2;
  exportedAt: string;
  themes: SlideTheme[];
}

function normalizeElement(el: ThemeElement): ThemeElement {
  return {
    ...el,
    visible: el.visible !== false,
    locked: Boolean(el.locked),
    css: el.css ?? {},
    name: el.name?.trim() || undefined,
  };
}

function buildThemePayload(theme: SlideTheme): SlideTheme {
  const pages = theme.pages?.length
    ? theme.pages.map((page) => {
        const normalized: ThemePage = {
          ...page,
          css: page.css ?? {},
          elements: page.elements.map(normalizeElement),
          guides: page.guides?.length ? page.guides : undefined,
        };
        if (!normalized.guides) delete normalized.guides;
        return normalized;
      })
    : undefined;
  const payload: SlideTheme = {
    ...theme,
    category: theme.category || "theme",
    css: pages ? {} : (theme.css ?? {}),
    elements: pages ? [] : (theme.elements ?? []).map(normalizeElement),
    pages,
    guides: pages ? undefined : theme.guides?.length ? theme.guides : undefined,
  };
  if (!payload.guides) delete payload.guides;
  return payload;
}

export function buildThemePackage(theme: SlideTheme): ThemePackageV2 {
  return {
    $schema: "https://openpresenter.dev/schemas/theme-v2.json",
    format: "open-presenter-theme",
    version: 2,
    exportedAt: new Date().toISOString(),
    theme: buildThemePayload(theme),
  };
}

export function buildThemesBackup(themes: SlideTheme[]): ThemesBackupPackageV2 {
  return {
    $schema: "https://openpresenter.dev/schemas/themes-backup-v2.json",
    format: "open-presenter-themes-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    themes: themes.map(buildThemePayload),
  };
}

function parseCss(value: unknown): Record<string, string> {
  const css: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw !== undefined && raw !== null) css[key] = String(raw);
    }
  }
  return css;
}

function parseElement(raw: unknown, label: string): ThemeElement {
  if (!raw || typeof raw !== "object") throw new Error(`${label}: elemento inválido.`);
  const el = raw as Record<string, unknown>;
  const type = String(el.type || "TEXT").toUpperCase();
  if (!["TEXT", "IMAGE", "VIDEO", "RECTANGLE"].includes(type)) {
    throw new Error(`${label}: tipo de elemento inválido "${type}".`);
  }
  return {
    id: typeof el.id === "string" && el.id ? el.id : label.replace(/[^a-z0-9]+/gi, "-"),
    type: type as ThemeElement["type"],
    x: typeof el.x === "number" ? el.x : 0,
    y: typeof el.y === "number" ? el.y : 0,
    visible: el.visible !== false,
    locked: Boolean(el.locked),
    css: parseCss(el.css),
    text: typeof el.text === "string" ? el.text : undefined,
    name: typeof el.name === "string" && el.name.trim() ? el.name.trim() : undefined,
    src: typeof el.src === "string" ? el.src : undefined,
    assetTypeVisibility: Array.isArray(el.assetTypeVisibility)
      ? el.assetTypeVisibility.map(String)
      : undefined,
    fill: typeof el.fill === "string" ? el.fill : undefined,
    url: typeof el.url === "string" ? el.url : undefined,
  };
}

function parseElements(value: unknown, label: string): ThemeElement[] {
  if (!Array.isArray(value)) {
    throw new Error(`Tema inválido: campo '${label}' deve ser uma lista de elementos.`);
  }
  return value.map((element, index) => parseElement(element, `${label}[${index}]`));
}

function parseGuides(value: unknown): ThemeGuide[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const guides: ThemeGuide[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const guide = raw as Record<string, unknown>;
    if (typeof guide.id !== "string" || !guide.id) continue;
    if (guide.axis !== "x" && guide.axis !== "y") continue;
    if (typeof guide.pos !== "number" || !Number.isFinite(guide.pos)) continue;
    guides.push({ id: guide.id, axis: guide.axis, pos: guide.pos });
  }
  return guides.length ? guides : undefined;
}

function parsePage(raw: unknown, index: number): ThemePage {
  if (!raw || typeof raw !== "object") throw new Error(`Página #${index + 1} inválida.`);
  const page = raw as Record<string, unknown>;
  const context = String(page.context || "").toLowerCase();
  if (!THEME_CONTEXTS.includes(context as ThemeContext)) {
    throw new Error(`Página #${index + 1}: contexto inválido "${context}".`);
  }
  const guides = parseGuides(page.guides);
  return {
    id: typeof page.id === "string" && page.id ? page.id : `page-${index + 1}`,
    context: context as ThemeContext,
    css: parseCss(page.css),
    elements: parseElements(page.elements, `pages[${index}].elements`),
    ...(guides ? { guides } : {}),
  };
}

export function parseThemeFromJson(rawJson: string | unknown, regenerateGuid = true): SlideTheme {
  const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Arquivo JSON inválido: conteúdo deve ser um objeto.");
  }
  const candidate = (parsed as { theme?: unknown }).theme ?? parsed;
  const rawTheme = candidate as Record<string, unknown>;
  if (typeof rawTheme.title !== "string" || !rawTheme.title.trim()) {
    throw new Error("Tema inválido: campo 'title' é obrigatório.");
  }

  const category =
    typeof rawTheme.category === "string" ? rawTheme.category : "theme";
  const hasPages = Array.isArray(rawTheme.pages);
  const pages = hasPages
    ? (rawTheme.pages as unknown[]).map((page, index) => parsePage(page, index))
    : undefined;
  if (hasPages && pages!.length === 0) {
    throw new Error("Tema inválido: deve conter ao menos uma página.");
  }
  if (pages) {
    const seen = new Set<string>();
    for (const page of pages) {
      if (seen.has(page.context)) {
        throw new Error(`Tema inválido: contexto duplicado "${page.context}".`);
      }
      if (page.context === "rest" && category !== "stage") {
        throw new Error(
          'Tema inválido: o contexto "rest" é exclusivo de temas de palco.',
        );
      }
      seen.add(page.context);
    }
  }

  const elements = Array.isArray(rawTheme.elements)
    ? parseElements(rawTheme.elements, "elements")
    : [];
  if (!pages && elements.length === 0) {
    throw new Error("Tema inválido: o tema deve conter ao menos um elemento.");
  }

  const now = new Date().toISOString();
  const guides = pages ? undefined : parseGuides(rawTheme.guides);
  return {
    guid: regenerateGuid
      ? crypto.randomUUID()
      : (typeof rawTheme.guid === "string" && rawTheme.guid ? rawTheme.guid : crypto.randomUUID()),
    title: rawTheme.title.trim(),
    category,
    css: pages ? {} : parseCss(rawTheme.css),
    elements: pages ? [] : elements,
    pages,
    createdAt: typeof rawTheme.createdAt === "string" ? rawTheme.createdAt : now,
    updatedAt: now,
    ...(guides ? { guides } : {}),
  };
}
