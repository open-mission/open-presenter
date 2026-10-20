import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { usePreferencesStore } from "@/features/preferences/store";
import type { OutputsSection, PreferencesTab } from "@/features/preferences/types";
import { PREFERENCES_NAV_ITEMS } from "@/features/preferences/nav";
import { AppearanceTab } from "@/features/preferences/tabs/AppearanceTab";
import { GeneralTab } from "@/features/preferences/tabs/GeneralTab";
import { OutputsTab } from "@/features/preferences/tabs/OutputsTab";
import { RemoteTab } from "@/features/preferences/tabs/RemoteTab";
import { ThemesTab } from "@/features/preferences/tabs/ThemesTab";
import { SongsTab } from "@/features/preferences/tabs/SongsTab";
import { UpdatesTab } from "@/features/preferences/tabs/UpdatesTab";
import { BrandMark } from "@/components/BrandMark";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/core/config/version";
import { isTauri } from "@/core/ipc/tauri";
import { closePreferencesWindow } from "@/core/ipc/commands";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useThemesSync } from "@/features/slide-themes/useThemeSync";
import { useOutputsSync } from "@/features/output-manager/useOutputsSync";
import { UpdateDialog } from "@/features/updates/UpdateDialog";
import { WhatsNewDialog } from "@/features/updates/WhatsNewDialog";

export default function PreferencesView() {
  const activeTab = usePreferencesStore((s) => s.activeTab);
  const setTab = usePreferencesStore((s) => s.setTab);
  const setOutputsSection = usePreferencesStore((s) => s.setOutputsSection);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);
  useThemesSync();
  useOutputsSync();

  // Seeds de temas na abertura da janela (best-effort).
  useEffect(() => {
    void ensureSeeded().catch(() => {});
  }, [ensureSeeded]);

  // Sync tab with localStorage on mount and across windows
  useEffect(() => {
    const saved = localStorage.getItem("open_presenter_pref_tab") as PreferencesTab | null;
    if (saved && PREFERENCES_NAV_ITEMS.some((n) => n.id === saved)) {
      setTab(saved);
    }
    const savedSection = localStorage.getItem(
      "open_presenter_outputs_section",
    ) as OutputsSection | null;
    if (
      savedSection &&
      (["public", "stage", "server", "devices"] as const).includes(savedSection)
    ) {
      setOutputsSection(savedSection);
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === "open_presenter_pref_tab" && e.newValue) {
        if (PREFERENCES_NAV_ITEMS.some((n) => n.id === e.newValue)) {
          setTab(e.newValue as PreferencesTab);
        }
      }
      if (e.key === "open_presenter_outputs_section" && e.newValue) {
        if (
          (["public", "stage", "server", "devices"] as const).includes(
            e.newValue as OutputsSection,
          )
        ) {
          setOutputsSection(e.newValue as OutputsSection);
        }
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [setTab, setOutputsSection]);

  // Close window on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isTauri()) {
          void closePreferencesWindow();
        } else {
          window.close();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentNav = PREFERENCES_NAV_ITEMS.find((item) => item.id === activeTab) || PREFERENCES_NAV_ITEMS[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      {/* Left Sidebar Navigation */}
      <aside className="flex w-56 flex-col border-r border-border/80 bg-muted/30 p-3 sm:w-64 shrink-0">
        <div className="flex items-center gap-2.5 px-3 pb-3 pt-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <BrandMark className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              Open Presenter
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Preferências
            </p>
          </div>
        </div>

        <nav className="mt-1 flex flex-1 flex-col gap-1">
          {PREFERENCES_NAV_ITEMS.map((item) => {
            const isSelected = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border/60 px-3 pt-3 text-[11px] text-muted-foreground/70">
          Open Presenter v{APP_VERSION}
        </div>
      </aside>

      {/* Right Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Header Bar */}
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-6">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Configurações</span>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
            <span className="font-semibold text-foreground">
              {currentNav.breadcrumb}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isTauri()) {
                void closePreferencesWindow();
              } else {
                window.close();
              }
            }}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Fechar configurações (Esc)"
          >
            <span>Fechar</span>
            <kbd className="rounded bg-muted px-1 py-0.2 font-mono text-[9px] text-muted-foreground">
              Esc
            </kbd>
          </Button>
        </div>

        {/* Content Body */}
        <ScrollArea className="min-h-0 min-w-0 flex-1 p-6">
          <div className="mx-auto w-full max-w-3xl pb-8">
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "outputs" && <OutputsTab />}
            {activeTab === "themes" && <ThemesTab />}
            {activeTab === "songs" && <SongsTab />}
            {activeTab === "remote" && <RemoteTab />}
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "updates" && <UpdatesTab />}
          </div>
        </ScrollArea>
      </div>

      <UpdateDialog />
      <WhatsNewDialog />
    </div>
  );
}
