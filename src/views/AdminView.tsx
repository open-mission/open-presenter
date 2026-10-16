import { useEffect, useState } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { openOutputWindow } from "@/core/ipc/commands";
import type { OutputTarget } from "@/core/types";
import { AppTopBar } from "@/components/AppTopBar";
import { PreferencesDialog } from "@/features/preferences/PreferencesDialog";
import { SetlistSidebar } from "@/features/events-setlists/SetlistSidebar";
import { SongSlidesColumn } from "@/features/events-setlists/SongSlidesColumn";
import { LivePreview } from "@/features/presentation/LivePreview";
import { ThemeRail } from "@/features/slide-themes/ThemeRail";
import { useLiveThemesPublisher, useThemesSync } from "@/features/slide-themes/useThemeSync";
import { useOutputsSync } from "@/features/output-manager/useOutputsSync";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useStageTimerSync } from "@/features/stage-display/useStageTimerSync";
import { SongEditorDialog } from "@/features/songs/SongEditorDialog";
import { OnlineLyricsDialog } from "@/features/songs/OnlineLyricsDialog";
import { ImportReportDialog } from "@/features/songs/ImportReportDialog";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useNativeMenu } from "@/core/ipc/useNativeMenu";

export default function AdminView() {
  usePresentationSync("admin");
  useOutputsSync();
  useStageTimerSync();
  useNativeMenu();
  useThemesSync();
  useLiveThemesPublisher();
  const loadSetlists = useSetlistStore((s) => s.load);
  const outputsLoaded = useOutputManagerStore((s) => s.loaded);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    void loadSetlists();
  }, [loadSetlists]);

  useEffect(() => {
    if (!outputsLoaded) return;
    const { configs, monitors, runtime } = useOutputManagerStore.getState();
    for (const target of ["public", "stage"] as const satisfies OutputTarget[]) {
      const config = configs[target];
      if (config.mode !== "native" && config.mode !== "both") continue;
      if (runtime[target]?.open) continue;
      if (
        config.monitorId &&
        !monitors.some((m) => m.id === config.monitorId)
      ) {
        continue;
      }
      void openOutputWindow(target, config.monitorId, config.monitorLabel);
    }
  }, [outputsLoaded]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground transition-colors">
      {/* Top Application Bar */}
      <AppTopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      {/* Main 3-Column Operator Workspace */}
      <main className="flex flex-1 overflow-hidden">
        {/* Column 1: Programação do Culto (Collapsible) */}
        {sidebarOpen && <SetlistSidebar />}

        {/* Column 2: Estrofes & Letras da Música Selecionada */}
        <SongSlidesColumn />

        {/* Column 3: Monitores de Preview (Um embaixo do outro) */}
        <section className="flex flex-1 flex-col overflow-y-auto bg-muted/10 p-4">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <LivePreview />
          </div>
        </section>

        {/* Column 4: Trilho de Temas (quick-switch) */}
        <ThemeRail />
      </main>

      {/* Preferences Modal Dialog (Native ⌘, shortcut or Edit > Preferences) */}
      <PreferencesDialog />

      {/* Song Editor Modal Dialog (Accessed via slide right-click / shortcut) */}
      <SongEditorDialog />

      {/* Online Lyrics Search Dialog (Accessed via menu Novo > Buscar música na internet / ⌘⇧F) */}
      <OnlineLyricsDialog />

      {/* Import Report Dialog (Holyrics import summary) */}
      <ImportReportDialog />
    </div>
  );
}
