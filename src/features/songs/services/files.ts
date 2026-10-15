import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@/core/ipc/tauri";

export async function pickHolyricsFile(): Promise<string | null> {
  if (!isTauri()) return null;
  return open({
    multiple: false,
    filters: [{ name: "Holyrics", extensions: ["json", "txt"] }],
  });
}
