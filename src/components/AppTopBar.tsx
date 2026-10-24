import { useEffect } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Image,
  LayoutGrid,
  Megaphone,
  Minus,
  Monitor,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Timer,
  Tv,
  Video,
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
import { isTauri } from "@/core/ipc/tauri";
import { openDisplaysWindow } from "@/core/ipc/commands";

import { useOutputManagerStore } from "@/features/output-manager/store";
import { usePreferencesStore } from "@/features/preferences/store";
import { usePresentationStore } from "@/features/presentation/store";
import { useRemoteStore } from "@/features/remote/store";
import { useNavigationStore } from "@/features/navigation/store";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
import { usePreviewLayoutStore } from "@/features/presentation/previewLayoutStore";
import { useDisplaysStore } from "@/features/displays/store";
import { SetlistSelector } from "@/features/events-setlists/SetlistSelector";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useCommunicationStore } from "@/features/communication";
import { useCommandPaletteStore } from "@/features/command-palette/store";

export function AppTopBar() {
  const live = usePresentationStore((s) => s.live);
  const openPreferences = usePreferencesStore((s) => s.openPreferences);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const remoteConfig = useRemoteStore((s) => s.config);
  const ensureRemoteToken = useRemoteStore((s) => s.ensureToken);
  const activeTab = useNavigationStore((s) => s.activeTab);
  const monitorsVisible = usePanelLayoutStore((s) => s.monitorsVisible);
  const toggleMonitors = usePanelLayoutStore((s) => s.toggleMonitors);
  const mediaOpen = usePanelLayoutStore((s) => s.mediaOpen);
  const toggleMedia = usePanelLayoutStore((s) => s.toggleMedia);

  const adjustmentsTab = usePreviewLayoutStore((s) => s.adjustmentsTab);
  const setAdjustmentsTab = usePreviewLayoutStore((s) => s.setAdjustmentsTab);

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
  const hiddenOutputIds = usePreviewLayoutStore((s) => s.hiddenOutputIds);
  const isOutputVisible = (id: string) => !hiddenOutputIds.includes(id);
  const toggleOutputVisibility = usePreviewLayoutStore((s) => s.toggleOutputVisibility);
  const configuredOutputs = useDisplaysStore((s) => s.outputs);

  useEffect(() => {
    if (isTauri()) void ensureRemoteToken();
  }, [ensureRemoteToken]);

  const remoteActive = Boolean(remoteConfig?.enabled && serverRunning);

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
      {/* Left section: Brand mark, Setlist selector and Agenda button */}
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => useSetlistStore.getState().openAgenda()}
          className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
          title="Abrir Agenda de Eventos"
        >
          <Calendar className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Agenda</span>
        </Button>

        {/* Menu Principal: Exibir */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
              title="Menu Exibir: Gerenciar visibilidade de abas, painéis e janelas"
            >
              <LayoutGrid className="size-3.5 text-primary" />
              <span>Exibir</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Painéis da Tela
            </DropdownMenuLabel>

            <DropdownMenuCheckboxItem
              checked={monitorsVisible}
              onCheckedChange={() => toggleMonitors()}
              onSelect={(e) => e.preventDefault()}
              className="text-xs cursor-pointer"
            >
              <Eye className="size-3.5 mr-2 text-primary" />
              <span>Painel de Previews</span>
              <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">⌥P</kbd>
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={mediaOpen}
              onCheckedChange={() => toggleMedia()}
              onSelect={(e) => e.preventDefault()}
              className="text-xs cursor-pointer"
            >
              <Image className="size-3.5 mr-2 text-purple-400" />
              <span>Painel de Mídias</span>
              <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">⌥M</kbd>
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Abas do Painel de Ajustes
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => {
                if (!monitorsVisible) toggleMonitors();
                setAdjustmentsTab("alerts");
              }}
              className="text-xs cursor-pointer"
            >
              <Megaphone className="size-3.5 mr-2 text-amber-400" />
              <span>Aba de Avisos</span>
              {adjustmentsTab === "alerts" && monitorsVisible && (
                <Check className="size-3.5 ml-auto text-primary" />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                if (!monitorsVisible) toggleMonitors();
                setAdjustmentsTab("timers");
              }}
              className="text-xs cursor-pointer"
            >
              <Timer className="size-3.5 mr-2 text-emerald-400" />
              <span>Aba de Cronômetros & Timers</span>
              {adjustmentsTab === "timers" && monitorsVisible && (
                <Check className="size-3.5 ml-auto text-primary" />
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Janelas Destacadas
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => void useCommunicationStore.getState().openWindow()}
              className="text-xs cursor-pointer"
            >
              <Megaphone className="size-3.5 mr-2 text-muted-foreground" />
              <span>Janela de Comunicação & Avisos…</span>
              <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">⌘M</kbd>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => useSetlistStore.getState().openAgenda()}
              className="text-xs cursor-pointer"
            >
              <Calendar className="size-3.5 mr-2 text-muted-foreground" />
              <span>Janela de Agenda de Eventos…</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                if (isTauri()) {
                  void openDisplaysWindow();
                } else {
                  window.open("#/displays", "_blank");
                }
              }}
              className="text-xs cursor-pointer"
            >
              <Monitor className="size-3.5 mr-2 text-muted-foreground" />
              <span>Gerenciar Saídas e Telas…</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => useCommandPaletteStore.getState().openPalette()}
              className="text-xs cursor-pointer font-semibold text-primary"
            >
              <Sparkles className="size-3.5 mr-2 text-primary" />
              <span>Paleta de Comandos…</span>
              <kbd className="ml-auto font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Gatilho Rápido para a Paleta Universal de Comandos */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => useCommandPaletteStore.getState().openPalette()}
          className="h-8 gap-2 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-card/40 border-border/70"
          title="Buscar músicas, bíblia, mídias e comandos (⌘K / Ctrl+K)"
        >
          <Search className="size-3.5 text-primary" />
          <span className="hidden md:inline">Buscar ou comando…</span>
          <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/70 text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
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

        {/* Preview: Botão Toggle Ativar/Desativar + Dropdown de Opções */}
        {activeTab === "presentation" && (
          <div className="flex items-center rounded-md border border-border bg-card/60 shadow-2xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!monitorsVisible) {
                  toggleMonitors();
                  showAll();
                } else {
                  toggleMonitors();
                }
              }}
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs font-medium rounded-r-none border-r border-border/80 cursor-pointer transition-colors",
                monitorsVisible
                  ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={
                monitorsVisible
                  ? "Ocultar painel de preview dos monitores"
                  : "Exibir e ativar painel de preview dos monitores"
              }
            >
              <Eye className={cn("size-3.5", monitorsVisible ? "text-primary" : "text-muted-foreground")} />
              <span className="hidden lg:inline">Preview</span>
              {monitorsVisible && (
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-6 p-0 rounded-l-none text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Opções de visibilidade dos monitores e zoom"
                >
                  <ChevronDown className="size-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Painel Lateral
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    if (!monitorsVisible) {
                      toggleMonitors();
                      showAll();
                    } else {
                      toggleMonitors();
                    }
                  }}
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
                onSelect={(e) => e.preventDefault()}
                className="text-xs cursor-pointer"
              >
                <Eye className="size-3.5 mr-2 text-primary" />
                <span>Prévia (Slides)</span>
              </DropdownMenuCheckboxItem>

              {configuredOutputs.length > 0 ? (
                configuredOutputs.map((out) => {
                  const isVisible = isOutputVisible(out.id);
                  const Icon =
                    out.category === "stage"
                      ? Monitor
                      : out.category === "lower"
                        ? Video
                        : Tv;
                  const color =
                    out.category === "stage"
                      ? "text-sky-400"
                      : out.category === "lower"
                        ? "text-purple-400"
                        : "text-emerald-400";
                  return (
                    <DropdownMenuCheckboxItem
                      key={out.id}
                      checked={isVisible}
                      onCheckedChange={() => toggleOutputVisibility(out.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="text-xs cursor-pointer"
                    >
                      <Icon className={cn("size-3.5 mr-2", color)} />
                      <span className="truncate">{out.name}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })
              ) : (
                <>
                  <DropdownMenuCheckboxItem
                    checked={showLive}
                    onCheckedChange={toggleLive}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs cursor-pointer"
                  >
                    <Tv className="size-3.5 mr-2 text-emerald-500" />
                    <span>Ao Vivo (Telão)</span>
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={showStage}
                    onCheckedChange={toggleStage}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs cursor-pointer"
                  >
                    <Monitor className="size-3.5 mr-2 text-sky-500" />
                    <span>Retorno (Palco)</span>
                  </DropdownMenuCheckboxItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={showAll}
                className="text-xs cursor-pointer"
              >
                <Eye className="size-3.5 mr-2" />
                <span>Reexibir todos</span>
              </DropdownMenuItem>

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
                onClick={() => {
                  if (isTauri()) {
                    void openDisplaysWindow();
                  } else {
                    window.open("#/displays", "_blank");
                  }
                }}
                className="text-xs cursor-pointer"
              >
                <Settings className="size-3.5 mr-2 text-muted-foreground" />
                <span>Gerenciar Saídas e Telas…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
