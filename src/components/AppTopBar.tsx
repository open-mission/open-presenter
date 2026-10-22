import { useEffect } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Image,
  Minus,
  Monitor,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Settings,
  Smartphone,
  Tv,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/core/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { outputHttpUrl } from "@/core/config/app";
import { isTauri } from "@/core/ipc/tauri";

import type { OutputMode } from "@/core/types";
import { isOutputActive } from "@/features/output-manager/outputActive";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { usePreferencesStore } from "@/features/preferences/store";
import { usePresentationStore } from "@/features/presentation/store";
import { useRemoteStore } from "@/features/remote/store";
import { useNavigationStore } from "@/features/navigation/store";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
import { usePreviewLayoutStore } from "@/features/presentation/previewLayoutStore";
import { SetlistSelector } from "@/features/events-setlists/SetlistSelector";
import { HeaderTimerControls } from "@/features/stage-display/HeaderTimerControls";
import { HeaderCommunicationButton } from "@/features/communication";

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

export function AppTopBar() {
  const live = usePresentationStore((s) => s.live);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);
  const publicConfig = useOutputManagerStore((s) => s.configs.public);
  const stageConfig = useOutputManagerStore((s) => s.configs.stage);
  const streamConfig = useOutputManagerStore((s) => s.configs.stream);
  const publicRuntime = useOutputManagerStore((s) => s.runtime.public);
  const stageRuntime = useOutputManagerStore((s) => s.runtime.stage);
  const streamRuntime = useOutputManagerStore((s) => s.runtime.stream);
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const remoteConfig = useRemoteStore((s) => s.config);
  const ensureRemoteToken = useRemoteStore((s) => s.ensureToken);
  const activeTab = useNavigationStore((s) => s.activeTab);
  const monitorsVisible = usePanelLayoutStore((s) => s.monitorsVisible);
  const toggleMonitors = usePanelLayoutStore((s) => s.toggleMonitors);

  const showPreview = usePreviewLayoutStore((s) => s.showPreview);
  const showLive = usePreviewLayoutStore((s) => s.showLive);
  const showStage = usePreviewLayoutStore((s) => s.showStage);
  const zoom = usePreviewLayoutStore((s) => s.zoom);
  const togglePreview = usePreviewLayoutStore((s) => s.togglePreview);
  const toggleLive = usePreviewLayoutStore((s) => s.toggleLive);
  const toggleStage = usePreviewLayoutStore((s) => s.toggleStage);
  const zoomIn = usePreviewLayoutStore((s) => s.zoomIn);
  const zoomOut = usePreviewLayoutStore((s) => s.zoomOut);
  const resetZoom = usePreviewLayoutStore((s) => s.resetZoom);
  const showAll = usePreviewLayoutStore((s) => s.showAll);

  useEffect(() => {
    if (isTauri()) void ensureRemoteToken();
  }, [ensureRemoteToken]);

  const remoteActive = Boolean(remoteConfig?.enabled && serverRunning);

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
  const streamActive = isOutputActive(
    streamConfig?.mode ?? "off",
    streamRuntime?.open ?? false,
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
  const streamTitle = statusTitle(
    "Transmissão",
    streamConfig?.mode ?? "off",
    streamConfig?.monitorLabel ?? null,
    outputHttpUrl(host, port, "/stream"),
    streamActive,
  );

  // Global shortcuts for quick projection actions (F: Background, C: Clear Text, B: Blackout)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const live = usePresentationStore.getState().live;
      if (live.content.kind === "blank") return;

      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], [role='dialog']",
        )
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
      {/* Left section: Brand mark and Setlist/Culto selector */}
      <div className="flex items-center gap-2">
        <div
          role="img"
          aria-label="Open Presenter"
          title="Open Presenter"
          className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background shadow-xs shrink-0"
        >
          <BrandMark className="size-4" />
        </div>

        <SetlistSelector />
      </div>

      {/* Center: Stage Timer & Countdown Controls + Communication Alerts */}
      <div className="flex items-center gap-2">
        <HeaderTimerControls />
        <HeaderCommunicationButton />
      </div>

      {/* Right section: Output status indicators, quick blackout/clear, and settings */}
      <div className="flex items-center gap-2">
        {/* Remote control settings */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="order-last h-8 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => openPreferences("remote")}
          title={
            remoteActive
              ? "Controle remoto ativo — abrir configurações"
              : "Configurar controle remoto"
          }
        >
          <span
            className={`size-1.5 rounded-full ${
              remoteActive
                ? "bg-emerald-500 animate-pulse"
                : "bg-muted-foreground/40"
            }`}
          />
          <Smartphone className="size-3.5" />
          <span className="hidden md:inline">Remote</span>
        </Button>

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
            onClick={() => openPreferences("outputs", "stage")}
            title={stageTitle}
          >
            <span
              className={`size-2 rounded-full ${
                stageActive ? "bg-sky-500 animate-pulse" : "bg-zinc-400"
              }`}
            />
            <span className="font-medium text-muted-foreground">Palco</span>
          </div>

          <span className="text-border">|</span>

          {/* Stream / OBS output status */}
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => openPreferences("outputs", "stream")}
            title={streamTitle}
          >
            <span
              className={`size-2 rounded-full ${
                streamActive ? "bg-purple-500 animate-pulse" : "bg-zinc-400"
              }`}
            />
            <span className="font-medium text-muted-foreground">OBS</span>
          </div>
        </div>

        {/* Preview: Dropdown de visualização e controle dos monitores de prévia */}
        {activeTab === "presentation" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
                title="Configurações e visibilidade dos previews"
              >
                <Eye className="size-3.5" />
                <span className="hidden lg:inline">Preview</span>
                <ChevronDown className="size-3 text-muted-foreground opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                Painel Lateral
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={toggleMonitors}
                className="text-xs cursor-pointer"
              >
                {monitorsVisible ? (
                  <>
                    <PanelRightClose className="size-3.5 mr-2 text-muted-foreground" />
                    <span>Ocultar painel de preview</span>
                  </>
                ) : (
                  <>
                    <PanelRightOpen className="size-3.5 mr-2 text-primary" />
                    <span>Exibir painel de preview</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                Monitores Visíveis
              </DropdownMenuLabel>

              <DropdownMenuCheckboxItem
                checked={showPreview}
                onCheckedChange={togglePreview}
                className="text-xs cursor-pointer"
              >
                <Eye className="size-3.5 mr-2 text-primary" />
                <span>Prévia (Slides)</span>
              </DropdownMenuCheckboxItem>

              <DropdownMenuCheckboxItem
                checked={showLive}
                onCheckedChange={toggleLive}
                className="text-xs cursor-pointer"
              >
                <Tv className="size-3.5 mr-2 text-emerald-500" />
                <span>Ao Vivo (Telão)</span>
              </DropdownMenuCheckboxItem>

              <DropdownMenuCheckboxItem
                checked={showStage}
                onCheckedChange={toggleStage}
                className="text-xs cursor-pointer"
              >
                <Monitor className="size-3.5 mr-2 text-sky-500" />
                <span>Retorno (Palco)</span>
              </DropdownMenuCheckboxItem>

              {(!showPreview || !showLive || !showStage) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={showAll}
                    className="text-xs cursor-pointer"
                  >
                    <Eye className="size-3.5 mr-2" />
                    <span>Reexibir todos</span>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                Zoom ({zoom}%)
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={zoomIn}
                disabled={zoom >= 150}
                className="text-xs cursor-pointer"
              >
                <Plus className="size-3.5 mr-2" />
                <span>Aumentar Zoom (+)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={zoomOut}
                disabled={zoom <= 50}
                className="text-xs cursor-pointer"
              >
                <Minus className="size-3.5 mr-2" />
                <span>Diminuir Zoom (-)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={resetZoom}
                disabled={zoom === 100}
                className="text-xs cursor-pointer"
              >
                <RotateCcw className="size-3.5 mr-2" />
                <span>Redefinir para 100%</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openPreferences("outputs")}
                className="text-xs cursor-pointer"
              >
                <Settings className="size-3.5 mr-2 text-muted-foreground" />
                <span>Gerenciar Saídas e Telas…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Controles de Projeção: Plano de Fundo, Sem Texto e Tela Preta agrupados */}
        <ButtonGroup aria-label="Controles de projeção">
          {/* Mostrar Plano de Fundo */}
          <Button
            type="button"
            size="sm"
            variant={live.cleared && !live.blackout ? "secondary" : "outline"}
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer",
              live.cleared && !live.blackout
                ? "bg-primary/15 text-primary border-primary/30 font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
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
            variant={live.textHidden ? "secondary" : "outline"}
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer",
              live.textHidden
                ? "bg-primary/15 text-primary border-primary/30 font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
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
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-semibold transition-all cursor-pointer",
              live.blackout
                ? "bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => void usePresentationStore.getState().toggleBlackout()}
            title="Alternar Tela Preta / Blackout (B)"
          >
            <Moon className="size-3.5" />
            <span className="hidden sm:inline">Tela Preta</span>
            <kbd className="hidden lg:inline rounded bg-muted/80 px-1 py-0.2 font-mono text-[9px]">
              B
            </kbd>
          </Button>
        </ButtonGroup>
      </div>
    </header>
  );
}
