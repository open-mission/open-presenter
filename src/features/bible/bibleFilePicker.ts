import { toast } from "sonner";
import { isTauri } from "@/core/ipc/tauri";

const BIBLE_FILTERS = [
  { name: "Bíblias", extensions: ["sqlite", "db", "json"] },
];

export async function pickBibleFiles(multiple = true): Promise<string[]> {
  if (!isTauri()) {
    toast.info(
      "A importação de arquivos SQLite/JSON está disponível no aplicativo Desktop.",
    );
    return [];
  }

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple,
      title: multiple
        ? "Selecione os arquivos da Bíblia (SQLite ou JSON)"
        : "Selecione o arquivo da Bíblia (SQLite ou JSON)",
      filters: BIBLE_FILTERS,
    });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Falha ao abrir seletor: ${message}`);
    return [];
  }
}