import { isTauri } from "@/core/ipc/tauri";
import {
  parseUiThemeFile,
  serializeUiThemeCss,
  serializeUiThemeJson,
  type UiTheme,
} from "@/core/theme/uiTheme";
import { toast } from "sonner";

const JSON_FILENAME = "open-presenter-tema-interface.json";
const CSS_FILENAME = "open-presenter-tema-interface.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function saveTextFile(
  content: string,
  filename: string,
  description: string,
  extension: "json" | "css",
): Promise<boolean> {
  if (isTauri()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        title: description,
        defaultPath: filename,
        filters: [
          {
            name: extension === "json" ? "Tema em JSON" : "Tema em CSS",
            extensions: [extension],
          },
        ],
      });

      if (!path) return false;
      await writeTextFile(path, content);
      return true;
    } catch (error) {
      toast.error(`Falha ao exportar o tema: ${errorMessage(error)}`);
      return false;
    }
  }

  triggerDownload(
    content,
    filename,
    extension === "json" ? "application/json" : "text/css",
  );
  return true;
}

export async function exportUiThemeJson(theme: UiTheme): Promise<void> {
  const saved = await saveTextFile(
    serializeUiThemeJson(theme),
    JSON_FILENAME,
    "Exportar tema da interface em JSON",
    "json",
  );
  if (saved) toast.success("Tema exportado em JSON.");
}

export async function exportUiThemeCss(theme: UiTheme): Promise<void> {
  const saved = await saveTextFile(
    serializeUiThemeCss(theme),
    CSS_FILENAME,
    "Exportar tema da interface em CSS",
    "css",
  );
  if (saved) toast.success("Tema exportado em CSS.");
}

export async function importUiThemeFile(): Promise<UiTheme | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const selected = await open({
        multiple: false,
        title: "Importar tema da interface",
        filters: [
          { name: "Tema da interface", extensions: ["json", "css"] },
        ],
      });

      if (!selected || typeof selected !== "string") return null;

      const theme = parseUiThemeFile(await readTextFile(selected));
      toast.success(`Tema "${theme.name}" importado.`);
      return theme;
    } catch (error) {
      toast.error(`Falha ao importar o tema: ${errorMessage(error)}`);
      return null;
    }
  }

  return new Promise<UiTheme | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.css,application/json,text/css";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const theme = parseUiThemeFile(await file.text());
        toast.success(`Tema "${theme.name}" importado.`);
        resolve(theme);
      } catch (error) {
        toast.error(`Falha ao importar o tema: ${errorMessage(error)}`);
        resolve(null);
      }
    };

    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
