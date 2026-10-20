import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "@/core/ipc/tauri";

export interface UpdateSummary {
  currentVersion: string;
  version: string;
  date: string | null;
  body: string | null;
}

export interface UpdateProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export async function checkForUpdate(): Promise<UpdateSummary | null> {
  if (!isTauri()) return null;

  const update = await check({ timeout: 20_000 });
  if (!update) return null;

  try {
    return {
      currentVersion: update.currentVersion,
      version: update.version,
      date: update.date ?? null,
      body: update.body ?? null,
    };
  } finally {
    await update.close();
  }
}

export async function downloadAndInstallUpdate(
  onProgress: (progress: UpdateProgress) => void,
): Promise<{ relaunchFailed: boolean }> {
  if (!isTauri()) {
    throw new Error("A atualização automática está disponível apenas no app desktop.");
  }

  const update = await check({ timeout: 20_000 });
  if (!update) {
    throw new Error("Nenhuma atualização disponível no momento.");
  }

  let downloadedBytes = 0;
  let totalBytes: number | null = null;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      totalBytes = event.data.contentLength ?? null;
      onProgress({ downloadedBytes: 0, totalBytes, percent: totalBytes ? 0 : null });
      return;
    }

    if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress({
        downloadedBytes,
        totalBytes,
        percent:
          totalBytes && totalBytes > 0
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : null,
      });
    }
  });

  try {
    await relaunch();
    return { relaunchFailed: false };
  } catch {
    // No Windows o instalador encerra o app antes de chegar aqui.
    return { relaunchFailed: true };
  }
}
