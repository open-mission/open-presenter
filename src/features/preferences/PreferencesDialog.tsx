import { useEffect } from "react";
import { ChevronRight, X } from "lucide-react";
import { usePreferencesStore } from "./store";
import { PREFERENCES_NAV_ITEMS } from "./nav";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { AudioTab } from "./tabs/AudioTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { OutputsTab } from "./tabs/OutputsTab";
import { RemoteTab } from "./tabs/RemoteTab";
import { ThemesTab } from "./tabs/ThemesTab";
import { SongsTab } from "./tabs/SongsTab";
import { UpdatesTab } from "./tabs/UpdatesTab";
import { BrandMark } from "@/components/BrandMark";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_VERSION } from "@/core/config/version";
import { listenCommand } from "@/core/ipc/tauri";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { UpdateDialog } from "@/features/updates/UpdateDialog";
import { WhatsNewDialog } from "@/features/updates/WhatsNewDialog";

export function PreferencesDialog() {
  const isOpen = usePreferencesStore((s) => s.isOpen);
  const activeTab = usePreferencesStore((s) => s.activeTab);
  const setTab = usePreferencesStore((s) => s.setTab);
  const closePreferences = usePreferencesStore((s) => s.closePreferences);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);

  // Seeds de temas no primeiro acesso às preferências (best-effort).
  useEffect(() => {
    if (isOpen) void ensureSeeded().catch(() => {});
  }, [isOpen, ensureSeeded]);

  // Keyboard shortcut listener (Cmd+, / Ctrl+, to open, Esc to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        if (usePreferencesStore.getState().isOpen) {
          usePreferencesStore.getState().closePreferences();
        } else {
          usePreferencesStore.getState().openPreferences();
        }
      } else if (e.key === "Escape" && usePreferencesStore.getState().isOpen) {
        e.preventDefault();
        usePreferencesStore.getState().closePreferences();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Tauri native event listener (from macOS application menu / native menu)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listenCommand("open-preferences", () => {
      openPreferences();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [openPreferences]);

  if (!isOpen) return null;

  const currentNav = PREFERENCES_NAV_ITEMS.find((item) => item.id === activeTab) || PREFERENCES_NAV_ITEMS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preferências do Sistema"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-150"
        onClick={closePreferences}
      />

      {/* Preferences Window */}
      <div className="relative z-10 flex h-[620px] w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-background text-foreground shadow-2xl transition-all animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Left Sidebar */}
        <aside className="flex w-56 flex-col border-r border-border/70 bg-muted/30 p-3 sm:w-60">
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
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-medium text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-accent text-accent-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <Icon
                    className={`size-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
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
          <div className="flex h-14 items-center justify-between border-b border-border/60 px-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Configurações</span>
              <ChevronRight className="size-3.5 text-muted-foreground/50" />
              <span className="font-semibold text-foreground">
                {currentNav.breadcrumb}
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={closePreferences}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar preferências"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Content Body */}
          <ScrollArea className="min-h-0 min-w-0 flex-1 p-6">
            <div className="mx-auto w-full max-w-3xl pb-6">
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "audio" && <AudioTab />}
              {activeTab === "outputs" && <OutputsTab />}
              {activeTab === "themes" && <ThemesTab />}
              {activeTab === "songs" && <SongsTab />}
              {activeTab === "remote" && <RemoteTab />}
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "updates" && <UpdatesTab />}
            </div>
          </ScrollArea>
        </div>
      </div>

      <UpdateDialog />
      <WhatsNewDialog />
    </div>
  );
}
