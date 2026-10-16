import { useEffect } from "react";
import {
  EyeOff,
  Image,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { outputHttpUrl } from "@/core/config/app";
import type { OutputMode } from "@/core/types";
import { isOutputActive } from "@/features/output-manager/outputActive";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { usePreferencesStore } from "@/features/preferences/store";
import { usePresentationStore } from "@/features/presentation/store";

interface AppTopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar(): void;
}

function statusTitle(
  label: string,
  mode: OutputMode,
  monitorLabel: string | null,
  url: string,
  active: boolean,
): string {
  if (!active) return "Clique para gerenciar Saídas (telas)";
  const modeLabel =
    mode === "native" ? "Nativa" : mode === "web" ? "Web" : "Ambas";
  const detail =
    mode === "web"
      ? url
      : `${monitorLabel ?? "monitor automático"}${mode === "both" ? ` · ${url}` : ""}`;
  return `${label} ativo — ${modeLabel} (${detail})`;
}

export function AppTopBar({ sidebarOpen, onToggleSidebar }: AppTopBarProps) {
  const live = usePresentationStore((s) => s.live);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);
  const publicConfig = useOutputManagerStore((s) => s.configs.public);
  const stageConfig = useOutputManagerStore((s) => s.configs.stage);
  const publicRuntime = useOutputManagerStore((s) => s.runtime.public);
  const stageRuntime = useOutputManagerStore((s) => s.runtime.stage);
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const serverRunning = useOutputManagerStore((s) => s.server.running);

  const publicActive = isOutputActive(
    publicConfig.mode,
    publicRuntime.open,
    serverRunning,
  );
  const stageActive = isOutputActive(
    stageConfig.mode,
    stageRuntime.open,
    serverRunning,
  );

  const publicTitle = statusTitle(
    "Público",
    publicConfig.mode,
    publicConfig.monitorLabel,
    outputHttpUrl(host, port, "/public"),
    publicActive,
  );
  const stageTitle = statusTitle(
    "Palco",
    stageConfig.mode,
    stageConfig.monitorLabel,
    outputHttpUrl(host, port, "/stage"),
    stageActive,
  );

  // Global shortcuts for quick projection actions (F: Background, C: Clear Text, B: Blackout)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        void usePresentationStore.getState().toggleBlackout();
      } else if (key === "c") {
        e.preventDefault();
        void usePresentationStore.getState().toggleClear();
      } else if (key === "f") {
        e.preventDefault();
        void usePresentationStore.getState().showBackground();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur-xs shrink-0">
      {/* Left section: Sidebar toggle button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Ocultar Programação" : "Mostrar Programação"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </Button>
      </div>

      {/* Right section: Output status indicators, quick blackout/clear, and settings */}
      <div className="flex items-center gap-2">
        {/* Output Targets Live Indicators */}
        <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] sm:flex">
          {/* Public output status */}
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => openPreferences("outputs")}
            title={publicTitle}
          >
            <span
              className={`size-2 rounded-full ${
                publicActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              }`}
            />
            <span className="font-medium text-muted-foreground">Público</span>
          </div>

          <span className="text-border">|</span>

          {/* Stage output status */}
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => openPreferences("outputs")}
            title={stageTitle}
          >
            <span
              className={`size-2 rounded-full ${
                stageActive ? "bg-sky-500 animate-pulse" : "bg-zinc-400"
              }`}
            />
            <span className="font-medium text-muted-foreground">Palco</span>
          </div>
        </div>

        {/* Mostrar Plano de Fundo */}
        <Button
          type="button"
          size="sm"
          variant={live.cleared && !live.blackout ? "secondary" : "outline"}
          className={`h-8 gap-1.5 px-2.5 text-xs font-medium transition-all ${
            live.cleared && !live.blackout
              ? "bg-primary/15 text-primary border-primary/30 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => void usePresentationStore.getState().showBackground()}
          title="Mostrar somente plano de fundo (F)"
        >
          <Image className="size-3.5" />
          <span className="hidden md:inline">Plano de Fundo</span>
          <kbd className="hidden lg:inline rounded bg-muted/80 px-1 py-0.2 font-mono text-[9px]">
            F
          </kbd>
        </Button>

        {/* Sem Texto */}
        <Button
          type="button"
          size="sm"
          variant={live.cleared && !live.blackout ? "secondary" : "outline"}
          className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => void usePresentationStore.getState().toggleClear()}
          title="Ocultar ou restaurar texto (C)"
        >
          <EyeOff className="size-3.5" />
          <span className="hidden sm:inline">Sem Texto</span>
          <kbd className="hidden lg:inline rounded bg-muted/80 px-1 py-0.2 font-mono text-[9px]">
            C
          </kbd>
        </Button>

        {/* Tela Preta (Blackout) */}
        <Button
          type="button"
          size="sm"
          variant={live.blackout ? "default" : "outline"}
          className={`h-8 gap-1.5 px-2.5 text-xs font-semibold transition-all ${
            live.blackout
              ? "bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => void usePresentationStore.getState().toggleBlackout()}
          title="Alternar Tela Preta / Blackout (B)"
        >
          <Moon className="size-3.5" />
          <span className="hidden sm:inline">Tela Preta</span>
          <kbd className="hidden lg:inline rounded bg-muted/80 px-1 py-0.2 font-mono text-[9px]">
            B
          </kbd>
        </Button>

        {/* Preferences Dialog Trigger */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => openPreferences()}
          title="Preferências (⌘,)"
        >
          <Settings className="size-3.5" />
          <kbd className="hidden rounded bg-muted px-1 py-0.2 font-mono text-[9px] text-muted-foreground sm:inline-block">
            ⌘,
          </kbd>
        </Button>
      </div>
    </header>
  );
}
