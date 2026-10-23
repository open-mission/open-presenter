import { useEffect, useState } from "react";
import {
  CalendarDays,
  Database,
  Globe,
  Keyboard,
  Maximize2,
  Megaphone,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { APP_VERSION } from "@/core/config/version";
import {
  getCloseToTray,
  setCloseToTray as persistCloseToTray,
  getStartMaximized,
  setStartMaximized as persistStartMaximized,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import type { WeekStart } from "@/core/types";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useCommunicationStore } from "@/features/communication/store";
import { usePreferencesStore } from "../store";

const WEEK_START_OPTIONS: { value: WeekStart; label: string }[] = [
  { value: "sunday", label: "Domingo" },
  { value: "monday", label: "Segunda-feira" },
];

interface ShortcutItem {
  key: string;
  action: string;
  scope: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { key: "⌘ ,", action: "Abrir configurações e preferências", scope: "Geral" },
  { key: "⌘ M", action: "Abrir painel de comunicação e avisos", scope: "Comunicação" },
  { key: "B", action: "Blackout (escurecer projeção ao vivo)", scope: "Apresentação" },
  { key: "C", action: "Limpar texto mantendo plano de fundo", scope: "Apresentação" },
  { key: "F", action: "Apresentar o plano de fundo", scope: "Apresentação" },
  { key: "Espaço / →", action: "Avançar para o próximo slide", scope: "Navegação" },
  { key: "Shift+Espaço / ←", action: "Retornar ao slide anterior", scope: "Navegação" },
  { key: "Enter", action: "Projetar slide selecionado", scope: "Navegação" },
  { key: "Esc", action: "Cancelar apresentação ativa / fechar modais", scope: "Geral" },
];

export function GeneralTab() {
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const weekStart = usePreferencesStore((s) => s.weekStart);
  const setWeekStart = usePreferencesStore((s) => s.setWeekStart);
  const openCommWindow = useCommunicationStore((s) => s.openWindow);
  const commPresets = useCommunicationStore((s) => s.presets);
  const [closeToTray, setCloseToTray] = useState(false);
  const [startMaximized, setStartMaximizedState] = useState(true);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void getCloseToTray().then((value) => {
      if (active) setCloseToTray(value);
    });
    void getStartMaximized().then((value) => {
      if (active) setStartMaximizedState(value);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleCloseToTray(enabled: boolean): void {
    setCloseToTray(enabled);
    void persistCloseToTray(enabled).catch(() => {
      setCloseToTray(!enabled);
      toast.error("Não foi possível salvar a configuração da bandeja.");
    });
  }

  function handleStartMaximized(enabled: boolean): void {
    setStartMaximizedState(enabled);
    void persistStartMaximized(enabled).catch(() => {
      setStartMaximizedState(!enabled);
      toast.error("Não foi possível salvar a configuração da janela.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Geral & Sistema
        </h3>
        <p className="text-xs text-muted-foreground">
          Status dos serviços locais e atalhos rápidos do operador.
        </p>
      </div>

      {/* App & Services Info */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
              <BrandMark className="size-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground">
                Open Presenter
              </h4>
              <p className="text-xs text-muted-foreground">
                Software de apresentação multimídia e projeção
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            v{APP_VERSION}
          </Badge>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Globe className="size-3.5 text-primary" />
            <span>Servidor: <code className="font-mono text-foreground font-semibold">{host}:{port}</code></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="size-3.5 text-emerald-500" />
            <span>SQLite: <span className="text-foreground font-medium">Conectado</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Motor: <span className="text-foreground font-medium">Tauri v2 + React 19</span></span>
          </div>
        </div>
      </div>

      {isTauri() && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-muted-foreground" />
              <h4 className="font-semibold text-xs text-foreground">
                Bandeja do sistema
              </h4>
            </div>

            <div className="flex items-center justify-between gap-6 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Manter na bandeja ao fechar
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Ao fechar a janela principal, o Open Presenter continua em
                  segundo plano. Use o ícone da bandeja para reabrir, acessar os
                  links do servidor ou sair do aplicativo.
                </p>
              </div>
              <Switch
                checked={closeToTray}
                onCheckedChange={handleCloseToTray}
                aria-label="Manter na bandeja ao fechar"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Maximize2 className="size-4 text-muted-foreground" />
              <h4 className="font-semibold text-xs text-foreground">
                Janela
              </h4>
            </div>

            <div className="flex items-center justify-between gap-6 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Iniciar com a janela maximizada
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Abre o aplicativo maximizado na inicialização. Ao desativar, o
                  tamanho e a posição da última janela são restaurados.
                </p>
              </div>
              <Switch
                checked={startMaximized}
                onCheckedChange={handleStartMaximized}
                aria-label="Iniciar com a janela maximizada"
              />
            </div>
          </div>
        </>
      )}

      {/* Agenda & Calendário */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h4 className="font-semibold text-xs text-foreground">
            Agenda & Calendário
          </h4>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Início da semana
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Define o primeiro dia exibido nas visões de semana e na lista da
              Agenda.
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-background/60 p-2 shadow-2xs">
            {WEEK_START_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                  weekStart === option.value
                    ? "bg-primary/5 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="app-week-start"
                  value={option.value}
                  checked={weekStart === option.value}
                  onChange={() => setWeekStart(option.value)}
                  className="accent-primary"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Painel de Comunicação & Avisos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground" />
          <h4 className="font-semibold text-xs text-foreground">
            Painel de Comunicação & Avisos
          </h4>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Janela de Comunicação & Atalhos Rápidos
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Envie alertas, avisos rolantes ou fixos para Palco (Stage), Telão Público ou Transmissão OBS. Cadastre e personalize os atalhos rápidos com 1 clique.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openCommWindow()}
              className="gap-2 shrink-0 cursor-pointer text-xs"
            >
              <Megaphone className="size-3.5 text-primary" />
              <span>Abrir Janela (⌘M)</span>
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>
              Atalhos rápidos cadastrados:{" "}
              <strong className="text-foreground">{commPresets.length}</strong>
            </span>
            <span className="text-[11px]">
              Gerenciáveis e configuráveis diretamente no painel lateral
            </span>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Keyboard className="size-4 text-muted-foreground" />
          <h4 className="font-semibold text-xs text-foreground">
            Atalhos do Operador
          </h4>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card/60">
          <div className="divide-y divide-border/60">
            {SHORTCUTS.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-4 py-2 text-xs transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <kbd className="inline-flex h-5 min-w-7 items-center justify-center rounded border border-border bg-muted/80 px-1.5 font-mono font-semibold text-[11px] text-foreground shadow-2xs">
                    {item.key}
                  </kbd>
                  <span className="font-medium text-foreground">
                    {item.action}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="font-normal text-[10px] text-muted-foreground"
                >
                  {item.scope}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
