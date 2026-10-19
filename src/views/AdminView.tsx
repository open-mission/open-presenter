import { useEffect, useState } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { openOutputWindow } from "@/core/ipc/commands";
import type { OutputTarget } from "@/core/types";
import { AppTopBar } from "@/components/AppTopBar";
import { AppDock } from "@/components/AppDock";
import { PreferencesDialog } from "@/features/preferences/PreferencesDialog";
import { SetlistSidebar } from "@/features/events-setlists/SetlistSidebar";
import { SongSlidesColumn } from "@/features/events-setlists/SongSlidesColumn";
import { LivePreview } from "@/features/presentation/LivePreview";
import { ThemeRail } from "@/features/slide-themes/ThemeRail";
import { useLiveThemesPublisher, useThemesSync } from "@/features/slide-themes/useThemeSync";
import { useOutputsSync } from "@/features/output-manager/useOutputsSync";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useWallpaperPublisher } from "@/features/presentation/useWallpaperPublisher";
import { useStageTimerSync } from "@/features/stage-display/useStageTimerSync";
import { SongEditorDialog } from "@/features/songs/SongEditorDialog";
import { OnlineLyricsDialog } from "@/features/songs/OnlineLyricsDialog";
import { ImportReportDialog } from "@/features/songs/ImportReportDialog";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useNativeMenu } from "@/core/ipc/useNativeMenu";
import { useNavigationStore } from "@/features/navigation/store";
import { SongsPage } from "@/features/songs/SongsPage";
import { AgendaCalendar } from "@/features/events-setlists/AgendaCalendar";
import { AgendaDialog } from "@/features/events-setlists/AgendaDialog";
import { CreateEventDialog } from "@/features/events-setlists/CreateEventDialog";
import { ImagesPage } from "@/features/image-browser/ImagesPage";
import { StudioPage } from "@/features/studio/StudioPage";
import { BiblePage } from "@/features/bible/BiblePage";
import { useRemoteSetlistPublisher } from "@/features/remote/useRemoteSetlistPublisher";

export default function AdminView() {
  usePresentationSync("admin");
  useOutputsSync();
  useWallpaperPublisher();
  useStageTimerSync();
  useNativeMenu();
  useThemesSync();
  useLiveThemesPublisher();
  useRemoteSetlistPublisher();
  const loadSetlists = useSetlistStore((s) => s.load);
  const outputsLoaded = useOutputManagerStore((s) => s.loaded);
  const activeTab = useNavigationStore((s) => s.activeTab);
  const setActiveTab = useNavigationStore((s) => s.setActiveTab);

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

      {/* Main Body: Dock Lateral on the left + Content Views */}
      <div className="flex flex-1 overflow-hidden">
        {/* Dock Lateral Apenas com icone no lado esquerdo */}
        <AppDock />

        {/* View 1: Apresentação & Culto ao Vivo */}
        {activeTab === "presentation" && (
          <main className="flex flex-1 overflow-hidden">
            {/* Column 1: Programação do Culto (Collapsible) */}
            {sidebarOpen && <SetlistSidebar />}

            {/* Column 2: Estrofes & Letras da Música Selecionada */}
            <SongSlidesColumn />

            {/* Column 3: Monitores de Preview */}
            <section className="flex flex-1 flex-col overflow-hidden border-r border-border/60 bg-muted/10">
              <LivePreview />
            </section>

            {/* Column 4: Trilho de Temas (quick-switch) */}
            <ThemeRail />
          </main>
        )}

        {/* View 2: Nova Página de Todas as Músicas & Letras */}
        {activeTab === "songs" && (
          <main className="flex flex-1 overflow-hidden">
            <SongsPage />
          </main>
        )}

        {/* View 3: Bíblia Sagrada & Exibição de Versículos */}
        {activeTab === "bible" && (
          <main className="flex flex-1 overflow-hidden">
            <BiblePage />
          </main>
        )}

        {/* View 3: Agenda & Cronograma de Eventos */}
        {activeTab === "agenda" && (
          <main className="flex flex-1 overflow-hidden">
            <AgendaCalendar onSelectAndSwitch={() => setActiveTab("presentation")} />
          </main>
        )}

        {/* View 4: Biblioteca de Imagens */}
        {activeTab === "images" && (
          <main className="flex flex-1 overflow-hidden">
            <ImagesPage />
          </main>
        )}

        {/* View 5: Studio de Criação & Apresentações */}
        {activeTab === "studio" && (
          <main className="flex flex-1 overflow-hidden">
            <StudioPage />
          </main>
        )}
      </div>

      {/* Preferences Modal Dialog (Native ⌘, shortcut or Edit > Preferences) */}
      <PreferencesDialog />

      {/* Song Editor Modal Dialog (Accessed via slide right-click / shortcut) */}
      <SongEditorDialog />

      {/* Online Lyrics Search Dialog (Accessed via menu Novo > Buscar música na internet / ⌘⇧F) */}
      <OnlineLyricsDialog />

      {/* Import Report Dialog (Holyrics import summary) */}
      <ImportReportDialog />

      {/* Quick Event Creation & Recurrence Dialog */}
      <CreateEventDialog />

      {/* Agenda Dialog (Modal version) */}
      <AgendaDialog />
    </div>
  );
}
