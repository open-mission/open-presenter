import { useEffect } from "react";
import { DisplaysManager } from "@/features/displays/DisplaysManager";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";
import { isTauri } from "@/core/ipc/tauri";
import { closeDisplaysWindow } from "@/core/ipc/commands";

export default function DisplaysView() {
  useDisplaysSync();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isTauri()) {
          void closeDisplaysWindow();
        } else {
          window.close();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-foreground">
      <DisplaysManager />
    </div>
  );
}
