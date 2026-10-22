import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/core/ipc/tauri";

export async function closeCurrentWindow(fallback: () => void): Promise<void> {
  if (isTauri()) {
    const closed = await getCurrentWindow()
      .close()
      .then(() => true)
      .catch(() => false);
    if (closed) return;
  }
  window.close();
  fallback();
}
