import { useEffect } from "react";
import { APP_VERSION } from "@/core/config/version";
import { isTauri } from "@/core/ipc/tauri";
import { hasSeenVersion, useUpdatesStore } from "./store";
import { getReleaseNotes } from "./releases";

export function useUpdateChecker(): void {
  useEffect(() => {
    const timers: number[] = [];
    const release = getReleaseNotes(APP_VERSION);

    if (release && !hasSeenVersion(APP_VERSION)) {
      timers.push(
        window.setTimeout(() => {
          if (!useUpdatesStore.getState().dialogOpen) {
            useUpdatesStore.getState().openWhatsNew();
          }
        }, 1200),
      );
    }

    if (isTauri() && useUpdatesStore.getState().autoCheck) {
      timers.push(
        window.setTimeout(() => {
          void useUpdatesStore.getState().checkNow({ silent: true });
        }, 4000),
      );
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);
}
