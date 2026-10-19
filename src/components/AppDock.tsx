import { useEffect } from "react";
import { BookOpen, Calendar, HelpCircle, Images, Music, Settings, Smartphone, Sparkles, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/core/ipc/tauri";
import { openShortcutsWindow } from "@/core/ipc/commands";
import { usePreferencesStore } from "@/features/preferences/store";
import { useNavigationStore } from "@/features/navigation/store";

interface NavButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  active: boolean;
  onClick: () => void;
}

function NavButton({ icon: Icon, label, shortcut, active, onClick }: NavButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`relative size-10 rounded-lg transition-all cursor-pointer ${
        active
          ? "bg-secondary text-primary font-bold shadow-xs border border-border/80 hover:bg-secondary/90 hover:text-primary"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
    >
      <Icon className={`size-5 ${active ? "text-primary" : ""}`} />
      {active && (
        <span className="absolute -left-1 top-2.5 h-5 w-1 rounded-r-full bg-primary" />
      )}
    </Button>
  );
}

export function AppDock() {
  const activeTab = useNavigationStore((s) => s.activeTab);
  const setActiveTab = useNavigationStore((s) => s.setActiveTab);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);

  // Global keyboard shortcuts: ⌘1 (Apresentação), ⌘2 (Músicas), ⌘3 (Bíblia), ⌘4 (Agenda), ⌘5 (Imagens), ⌘6 (Studio)
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

      if (e.key === "1") {
        e.preventDefault();
        setActiveTab("presentation");
      } else if (e.key === "2") {
        e.preventDefault();
        setActiveTab("songs");
      } else if (e.key === "3") {
        e.preventDefault();
        setActiveTab("bible");
      } else if (e.key === "4") {
        e.preventDefault();
        setActiveTab("agenda");
      } else if (e.key === "5") {
        e.preventDefault();
        setActiveTab("images");
      } else if (e.key === "6") {
        e.preventDefault();
        setActiveTab("studio");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTab]);

  function handleOpenShortcuts() {
    if (isTauri()) {
      void openShortcutsWindow();
    } else {
      window.open("/#/shortcuts", "_blank", "width=700,height=580");
    }
  }

  return (
    <nav
      aria-label="Barra Lateral de Navegação"
      className="flex w-13 shrink-0 flex-col items-center justify-between border-r border-border bg-muted/25 py-3 select-none"
    >
      {/* Top Primary Navigation Icons */}
      <div className="flex flex-col items-center gap-2">
        {/* Apresentação (Culto ao Vivo) */}
        <NavButton
          icon={Tv}
          label="Culto & Apresentação"
          shortcut="⌘1"
          active={activeTab === "presentation"}
          onClick={() => setActiveTab("presentation")}
        />

        {/* Músicas & Letras */}
        <NavButton
          icon={Music}
          label="Músicas & Letras"
          shortcut="⌘2"
          active={activeTab === "songs"}
          onClick={() => setActiveTab("songs")}
        />

        {/* Bíblia & Versículos */}
        <NavButton
          icon={BookOpen}
          label="Bíblia & Versículos"
          shortcut="⌘3"
          active={activeTab === "bible"}
          onClick={() => setActiveTab("bible")}
        />

        {/* Agenda & Eventos */}
        <NavButton
          icon={Calendar}
          label="Agenda & Cronograma"
          shortcut="⌘4"
          active={activeTab === "agenda"}
          onClick={() => setActiveTab("agenda")}
        />

        {/* Biblioteca de Imagens */}
        <NavButton
          icon={Images}
          label="Biblioteca de Imagens"
          shortcut="⌘5"
          active={activeTab === "images"}
          onClick={() => setActiveTab("images")}
        />

        {/* Studio de Criação & Apresentações */}
        <NavButton
          icon={Sparkles}
          label="Studio de Criação"
          shortcut="⌘6"
          active={activeTab === "studio"}
          onClick={() => setActiveTab("studio")}
        />
      </div>

      {/* Bottom Secondary Icons: Remote, Preferences & Shortcuts */}
      <div className="flex flex-col items-center gap-2">
        <NavButton
          icon={Smartphone}
          label="Controle Remoto"
          active={false}
          onClick={() => openPreferences("remote")}
        />

        <NavButton
          icon={Settings}
          label="Preferências"
          shortcut="⌘,"
          active={false}
          onClick={() => openPreferences()}
        />

        <NavButton
          icon={HelpCircle}
          label="Atalhos de Teclado"
          shortcut="⌘/"
          active={false}
          onClick={handleOpenShortcuts}
        />
      </div>
    </nav>
  );
}
