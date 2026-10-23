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

export async function forceCloseCurrentWindow(fallback: () => void): Promise<void> {
  if (isTauri()) {
    try {
      await getCurrentWindow().destroy();
      return;
    } catch {
      try {
        await getCurrentWindow().close();
        return;
      } catch {
        // Fallback below
      }
    }
  }
  window.close();
  fallback();
}
