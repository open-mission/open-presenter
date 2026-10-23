import { useEffect, useRef, useState } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { openOutputWindow } from "@/core/ipc/commands";
import type { OutputTarget } from "@/core/types";
import { AppTopBar } from "@/components/AppTopBar";
import { AppDock } from "@/components/AppDock";
import { ResizeHandle } from "@/components/ResizeHandle";
import {
  fitPanelLayout,
  SETLIST_WIDTH_DEFAULT,
  SETLIST_WIDTH_MAX,
  SETLIST_WIDTH_MIN,
  SLIDES_WIDTH_DEFAULT,
  SLIDES_WIDTH_MAX,
  SLIDES_WIDTH_MIN,
} from "@/core/lib/panelLayout";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
import { cn } from "@/core/lib/utils";
import { PreferencesDialog } from "@/features/preferences/PreferencesDialog";
import { SetlistSidebar } from "@/features/events-setlists/SetlistSidebar";
import { SongSlidesColumn } from "@/features/events-setlists/SongSlidesColumn";
import { LivePreview } from "@/features/presentation/LivePreview";
import { ThemeRail } from "@/features/slide-themes/ThemeRail";
import { useLiveThemesPublisher, useThemesSync } from "@/features/slide-themes/useThemeSync";
import { useOutputPlansPublisher } from "@/features/slide-themes/useOutputPlansPublisher";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useOutputsSync } from "@/features/output-manager/useOutputsSync";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useWallpaperPublisher } from "@/features/presentation/useWallpaperPublisher";
import { useStageTimerSync } from "@/features/stage-display/useStageTimerSync";
import { SongEditorDialog } from "@/features/songs/SongEditorDialog";
import { OnlineLyricsDialog } from "@/features/songs/OnlineLyricsDialog";
import { ImportReportDialog } from "@/features/songs/ImportReportDialog";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useSongDefaultsStore } from "@/core/store/songDefaultsStore";
import { useNativeMenu } from "@/core/ipc/useNativeMenu";
import { useNavigationStore } from "@/features/navigation/store";
import { SongsPage } from "@/features/songs/SongsPage";
import { AgendaCalendar } from "@/features/events-setlists/AgendaCalendar";
import { AgendaDialog } from "@/features/events-setlists/AgendaDialog";
import { CreateEventDialog } from "@/features/events-setlists/CreateEventDialog";
import { ImagesPage } from "@/features/image-browser/ImagesPage";
import { StudioPage } from "@/features/studio/StudioPage";
import { BiblePage } from "@/features/bible/BiblePage";
import { useBibleLiveSync } from "@/features/bible/useBibleLiveSync";
import { useRemoteSetlistPublisher } from "@/features/remote/useRemoteSetlistPublisher";
import { UpdateDialog } from "@/features/updates/UpdateDialog";
import { WhatsNewDialog } from "@/features/updates/WhatsNewDialog";
import { useUpdateChecker } from "@/features/updates/useUpdateChecker";
import {
  useCommunicationStore,
  useCommunicationSync,
} from "@/features/communication";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";

export default function AdminView() {
  usePresentationSync("admin");
  useOutputsSync();
  useDisplaysSync();
  useWallpaperPublisher();
  useStageTimerSync();
  useNativeMenu();
  useThemesSync();
  useLiveThemesPublisher();
  useOutputPlansPublisher();
  useRemoteSetlistPublisher();
  useBibleLiveSync();
  useUpdateChecker();
  useCommunicationSync();

  // Global shortcut ⌘M / Ctrl+M: Abre o Painel de Comunicação & Avisos
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        void useCommunicationStore.getState().openWindow();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const loadSetlists = useSetlistStore((s) => s.load);
  const loadSongDefaults = useSongDefaultsStore((s) => s.load);
  const addEmptySlideAtStart = useSongDefaultsStore(
    (s) => s.addEmptySlideAtStart,
  );
  const outputsLoaded = useOutputManagerStore((s) => s.loaded);
  const activeTab = useNavigationStore((s) => s.activeTab);
  const setActiveTab = useNavigationStore((s) => s.setActiveTab);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const ensureSeededThemes = useSlideThemesStore((s) => s.ensureSeeded);

  const setlistWidth = usePanelLayoutStore((s) => s.setlistWidth);
  const slidesWidth = usePanelLayoutStore((s) => s.slidesWidth);
  const monitorsVisible = usePanelLayoutStore((s) => s.monitorsVisible);
  const setSetlistWidth = usePanelLayoutStore((s) => s.setSetlistWidth);
  const setSlidesWidth = usePanelLayoutStore((s) => s.setSlidesWidth);
  const mainRef = useRef<HTMLElement>(null);
  const [mainWidth, setMainWidth] = useState(0);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setMainWidth(element.clientWidth));
    observer.observe(element);
    setMainWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [activeTab]);

  const fitted =
    monitorsVisible && mainWidth > 0
      ? fitPanelLayout({ setlistWidth, slidesWidth }, mainWidth - 192)
      : { setlistWidth, slidesWidth };

  useEffect(() => {
    void ensureSeededThemes();
  }, [ensureSeededThemes]);

  useEffect(() => {
    void loadSetlists();
  }, [loadSetlists]);

  useEffect(() => {
    void loadSongDefaults().catch((err) => {
      console.error("Falha ao carregar preferências de música:", err);
    });
  }, [loadSongDefaults]);

  const previousAddEmptySlideAtStart = useRef(addEmptySlideAtStart);
  useEffect(() => {
    const previous = previousAddEmptySlideAtStart.current;
    previousAddEmptySlideAtStart.current = addEmptySlideAtStart;
    if (previous === addEmptySlideAtStart) return;
    useSetlistStore
      .getState()
      .shiftRunnerIndex(addEmptySlideAtStart ? 1 : -1, addEmptySlideAtStart);
  }, [addEmptySlideAtStart]);

  useEffect(() => {
    if (!outputsLoaded) return;
    const { configs, monitors, runtime } = useOutputManagerStore.getState();
    for (const target of ["public", "stage", "stream"] as const satisfies OutputTarget[]) {
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
      <AppTopBar />

      {/* Main Body: Dock Lateral on the left + Content Views */}
      <div className="flex flex-1 overflow-hidden">
        {/* Dock Lateral Apenas com icone no lado esquerdo */}
        <AppDock />

        {/* View 1: Apresentação & Culto ao Vivo */}
        {activeTab === "presentation" && (
          <main ref={mainRef} className="flex flex-1 overflow-hidden">
            <SetlistSidebar
              collapsed={!sidebarOpen}
              width={fitted.setlistWidth}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />

            {sidebarOpen && (
              <ResizeHandle
                label="Redimensionar programação"
                value={fitted.setlistWidth}
                min={SETLIST_WIDTH_MIN}
                max={SETLIST_WIDTH_MAX}
                defaultValue={SETLIST_WIDTH_DEFAULT}
                onChange={setSetlistWidth}
              />
            )}

            <div
              className={cn(
                "flex min-h-0",
                monitorsVisible ? "shrink-0" : "flex-1",
              )}
              style={monitorsVisible ? { width: fitted.slidesWidth } : undefined}
            >
              <SongSlidesColumn />
            </div>

            {monitorsVisible && (
              <ResizeHandle
                label="Redimensionar letra e versículos"
                value={fitted.slidesWidth}
                min={SLIDES_WIDTH_MIN}
                max={SLIDES_WIDTH_MAX}
                defaultValue={SLIDES_WIDTH_DEFAULT}
                onChange={setSlidesWidth}
              />
            )}

            <section
              className={cn(
                "flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border/60 bg-muted/10",
                !monitorsVisible && "hidden",
              )}
            >
              <LivePreview />
            </section>

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

      {/* Release notes and in-app update dialogs */}
      <UpdateDialog />
      <WhatsNewDialog />
    </div>
  );
}
