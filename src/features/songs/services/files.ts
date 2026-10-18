import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@/core/ipc/tauri";

export async function pickHolyricsFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const selected = await open({
    multiple: true,
    filters: [{ name: "Holyrics", extensions: ["json", "txt"] }],
  });
  if (typeof selected === "string") return [selected];
  if (!Array.isArray(selected)) return [];
  return selected.filter((path) => typeof path === "string");
}
