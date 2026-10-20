import type { SlideTheme } from "@/core/types";
import { saveTheme } from "@/core/ipc/commands";
import { toast } from "sonner";
import { isTauri } from "@/core/ipc/tauri";
import { buildThemePackage, buildThemesBackup, parseThemeFromJson } from "./themePackage";

export { parseThemeFromJson } from "./themePackage";
export type { ThemePackageV2, ThemesBackupPackageV2 } from "./themePackage";

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
  const pkg = buildThemePackage(theme);

  const filename = `${slugify(theme.title)}.openpresenter-theme.json`;
  triggerDownload(JSON.stringify(pkg, null, 2), filename);
  toast.success(`Tema "${theme.title}" exportado com sucesso!`);
}

/**
 * Exporta múltiplos temas como backup em lote.
 */
export function exportThemesBackup(themes: SlideTheme[]): void {
  const pkg = buildThemesBackup(themes);

  const filename = `openpresenter-temas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  triggerDownload(JSON.stringify(pkg, null, 2), filename);
  toast.success(`${themes.length} temas exportados com sucesso!`);
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
