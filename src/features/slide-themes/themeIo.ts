import type { SlideTheme, ThemeElement } from "@/core/types";
import { saveTheme } from "@/core/ipc/commands";
import { toast } from "sonner";
import { isTauri } from "@/core/ipc/tauri";

export interface ThemePackage {
  $schema?: string;
  format: "open-presenter-theme";
  version: 1;
  exportedAt: string;
  theme: SlideTheme;
}

export interface ThemesBackupPackage {
  $schema?: string;
  format: "open-presenter-themes-backup";
  version: 1;
  exportedAt: string;
  themes: SlideTheme[];
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "") || "tema";
}

function triggerDownload(content: string, filename: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta um tema individual para arquivo JSON (.openpresenter-theme.json).
 * Ideal para backup, compartilhamento ou geração via IA.
 */
export function exportThemeAsJson(theme: SlideTheme): void {
  const pkg: ThemePackage = {
    $schema: "https://openpresenter.dev/schemas/theme-v1.json",
    format: "open-presenter-theme",
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: {
      guid: theme.guid,
      title: theme.title,
      category: theme.category || "theme",
      css: theme.css || {},
      elements: theme.elements.map((el) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        visible: el.visible !== false,
        locked: Boolean(el.locked),
        css: el.css || {},
        text: el.text,
        src: el.src,
        assetTypeVisibility: el.assetTypeVisibility,
        fill: el.fill,
        url: el.url,
      })),
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    },
  };

  const filename = `${slugify(theme.title)}.openpresenter-theme.json`;
  triggerDownload(JSON.stringify(pkg, null, 2), filename);
  toast.success(`Tema "${theme.title}" exportado com sucesso!`);
}

/**
 * Exporta múltiplos temas como backup em lote.
 */
export function exportThemesBackup(themes: SlideTheme[]): void {
  const pkg: ThemesBackupPackage = {
    $schema: "https://openpresenter.dev/schemas/themes-backup-v1.json",
    format: "open-presenter-themes-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    themes,
  };

  const filename = `openpresenter-temas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  triggerDownload(JSON.stringify(pkg, null, 2), filename);
  toast.success(`${themes.length} temas exportados com sucesso!`);
}

/**
 * Valida e converte um objeto ou string JSON em SlideTheme válido.
 * Aceita tanto o formato empacotado quanto a estrutura direta de SlideTheme.
 */
export function parseThemeFromJson(rawJson: string | unknown, regenerateGuid = true): SlideTheme {
  const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Arquivo JSON inválido: conteúdo deve ser um objeto.");
  }

  // Suporte a formato empacotado ({ format: 'open-presenter-theme', theme: { ... } })
  const candidate = (parsed as { theme?: unknown }).theme || parsed;
  const rawTheme = candidate as Record<string, unknown>;

  if (typeof rawTheme.title !== "string" || !rawTheme.title.trim()) {
    throw new Error("Tema inválido: campo 'title' é obrigatório.");
  }

  if (!Array.isArray(rawTheme.elements)) {
    throw new Error("Tema inválido: campo 'elements' deve ser uma lista de elementos.");
  }

  if (rawTheme.elements.length === 0) {
    throw new Error("Tema inválido: o tema deve conter ao menos um elemento.");
  }

  const validElements: ThemeElement[] = rawTheme.elements.map((elRaw, idx) => {
    if (!elRaw || typeof elRaw !== "object") {
      throw new Error(`Elemento #${idx + 1} inválido no tema.`);
    }
    const el = elRaw as Record<string, unknown>;
    const type = String(el.type || "TEXT").toUpperCase();
    if (!["TEXT", "IMAGE", "VIDEO", "RECTANGLE"].includes(type)) {
      throw new Error(`Tipo de elemento inválido: "${type}". Permitidos: TEXT, IMAGE, VIDEO, RECTANGLE.`);
    }

    const cssObj: Record<string, string> = {};
    if (el.css && typeof el.css === "object") {
      for (const [k, v] of Object.entries(el.css as Record<string, unknown>)) {
        if (v !== undefined && v !== null) {
          cssObj[k] = String(v);
        }
      }
    }

    return {
      id: typeof el.id === "string" && el.id ? el.id : `elem-${idx + 1}`,
      type: type as ThemeElement["type"],
      x: typeof el.x === "number" ? el.x : 0,
      y: typeof el.y === "number" ? el.y : 0,
      visible: el.visible !== false,
      locked: Boolean(el.locked),
      css: cssObj,
      text: typeof el.text === "string" ? el.text : undefined,
      src: typeof el.src === "string" ? el.src : undefined,
      assetTypeVisibility: Array.isArray(el.assetTypeVisibility)
        ? el.assetTypeVisibility.map(String)
        : undefined,
      fill: typeof el.fill === "string" ? el.fill : undefined,
      url: typeof el.url === "string" ? el.url : undefined,
    };
  });

  const cssTheme: Record<string, string> = {};
  if (rawTheme.css && typeof rawTheme.css === "object") {
    for (const [k, v] of Object.entries(rawTheme.css as Record<string, unknown>)) {
      if (v !== undefined && v !== null) {
        cssTheme[k] = String(v);
      }
    }
  }

  const now = new Date().toISOString();
  return {
    guid: regenerateGuid ? crypto.randomUUID() : (String(rawTheme.guid) || crypto.randomUUID()),
    title: String(rawTheme.title).trim(),
    category: typeof rawTheme.category === "string" ? (rawTheme.category as SlideTheme["category"]) : "theme",
    css: cssTheme,
    elements: validElements,
    createdAt: typeof rawTheme.createdAt === "string" ? rawTheme.createdAt : now,
    updatedAt: now,
  };
}

/**
 * Abre o seletor de arquivo e importa um tema JSON, salvando-o no banco.
 */
export async function importThemeFile(): Promise<SlideTheme | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");

      const selected = await open({
        multiple: false,
        title: "Selecione o arquivo do tema (JSON)",
        filters: [{ name: "Tema Open Presenter", extensions: ["json"] }],
      });

      if (!selected || typeof selected !== "string") return null;

      const content = await readTextFile(selected);
      const theme = parseThemeFromJson(content, true);
      await saveTheme(theme);
      toast.success(`Tema "${theme.title}" importado com sucesso!`);
      return theme;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao importar tema: ${msg}`);
      return null;
    }
  }

  // Fallback Web (input type="file")
  return new Promise<SlideTheme | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const theme = parseThemeFromJson(text, true);
        await saveTheme(theme);
        toast.success(`Tema "${theme.title}" importado com sucesso!`);
        resolve(theme);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Falha ao importar tema: ${msg}`);
        resolve(null);
      }
    };
    input.click();
  });
}
