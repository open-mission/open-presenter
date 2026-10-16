import { useEffect, useState } from "react";
import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { AppTopBar } from "@/components/AppTopBar";
import { PreferencesDialog } from "@/features/preferences/PreferencesDialog";
import { SetlistSidebar } from "@/features/events-setlists/SetlistSidebar";
import { SongSlidesColumn } from "@/features/events-setlists/SongSlidesColumn";
import { LivePreview } from "@/features/presentation/LivePreview";
import { ThemeRail } from "@/features/slide-themes/ThemeRail";
import { SongEditorDialog } from "@/features/songs/SongEditorDialog";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useNativeMenu } from "@/core/ipc/useNativeMenu";

export default function AdminView() {
  usePresentationSync();
  useNativeMenu();
  const loadSetlists = useSetlistStore((s) => s.load);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    void loadSetlists();
  }, [loadSetlists]);

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
    </div>
  );
}
