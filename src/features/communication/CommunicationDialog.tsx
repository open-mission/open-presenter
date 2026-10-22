import { useState } from "react";
import {
  Clock,
  History,
  Megaphone,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/core/lib/utils";
import { useCommunicationStore } from "./store";
import { DEFAULT_PRESETS } from "./presets";
import type { CommunicationDisplayMode, CommunicationLevel } from "./types";

const DISPLAY_MODES: {
  id: CommunicationDisplayMode;
  label: string;
  description: string;
}[] = [
  {
    id: "banner_top",
    label: "Barra Superior",
    description: "Faixa no topo da tela do retorno",
  },
  {
    id: "banner_bottom",
    label: "Barra Inferior",
    description: "Faixa no rodapé da tela do retorno",
  },
  {
    id: "overlay",
    label: "Tela Cheia",
    description: "Aviso centralizado em destaque sobre o slide",
  },
  {
    id: "variable_only",
    label: "Apenas Variável",
    description: "Exibe no tema de retorno via {stage_message}",
  },
];

const LEVELS: {
  id: CommunicationLevel;
  label: string;
  badge: string;
  activeColor: string;
}[] = [
  {
    id: "info",
    label: "Normal / Info",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    activeColor: "border-sky-500 bg-sky-950/40 text-sky-200",
  },
  {
    id: "warning",
    label: "Atenção",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    activeColor: "border-amber-500 bg-amber-950/40 text-amber-200",
  },
  {
    id: "urgent",
    label: "Urgente",
    badge: "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse",
    activeColor: "border-red-500 bg-red-950/40 text-red-200",
  },
];

const TIMER_PRESETS = [
  { label: "Manual", secs: 0 },
  { label: "10 seg", secs: 10 },
  { label: "30 seg", secs: 30 },
  { label: "1 min", secs: 60 },
  { label: "5 min", secs: 300 },
];

export function CommunicationDialog() {
  const isOpen = useCommunicationStore((s) => s.isOpen);
  const closeDialog = useCommunicationStore((s) => s.closeDialog);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const draftText = useCommunicationStore((s) => s.draftText);
  const setDraftText = useCommunicationStore((s) => s.setDraftText);
  const displayMode = useCommunicationStore((s) => s.displayMode);
  const setDisplayMode = useCommunicationStore((s) => s.setDisplayMode);
  const scroll = useCommunicationStore((s) => s.scroll);
  const setScroll = useCommunicationStore((s) => s.setScroll);
  const level = useCommunicationStore((s) => s.level);
  const setLevel = useCommunicationStore((s) => s.setLevel);
  const autoDismissSeconds = useCommunicationStore(
    (s) => s.autoDismissSeconds,
  );
  const setAutoDismissSeconds = useCommunicationStore(
    (s) => s.setAutoDismissSeconds,
  );
  const history = useCommunicationStore((s) => s.history);
  const sendAlert = useCommunicationStore((s) => s.sendAlert);
  const clearAlert = useCommunicationStore((s) => s.clearAlert);
  const usePreset = useCommunicationStore((s) => s.usePreset);

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  const canScroll =
    displayMode === "banner_top" || displayMode === "banner_bottom";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void sendAlert();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border/80 bg-background text-foreground shadow-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Megaphone className="size-4" />
              </div>
              <DialogTitle className="text-base font-bold">
                Painel de Comunicação & Avisos
              </DialogTitle>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer",
                  activeTab === "new"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Enviar Mensagem
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer flex items-center gap-1",
                  activeTab === "history"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <History className="size-3" />
                <span>Recentes ({history.length})</span>
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Envie mensagens e orientações em tempo real para o retorno (Stage).
          </DialogDescription>
        </DialogHeader>

        {/* Banner de Alerta Ativo Atualmente no Retorno */}
        {activeAlert && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
              </span>
              <span className="font-semibold text-amber-300 shrink-0">
                Ativo no Retorno:
              </span>
              <span className="truncate text-foreground font-medium">
                "{activeAlert.text}"
              </span>
              <Badge variant="outline" className="text-[10px] uppercase ml-1 shrink-0">
                {activeAlert.displayMode.replace("_", " ")}
              </Badge>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1 shrink-0 cursor-pointer"
              onClick={() => void clearAlert()}
            >
              <Trash2 className="size-3" />
              <span>Limpar Retorno</span>
            </Button>
          </div>
        )}

        {activeTab === "new" ? (
          <div className="space-y-4 pt-1">
            {/* Mensagens Rápidas / Presets de Igreja */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Zap className="size-3 text-amber-400" />
                <span>Atalhos Rápidos de Palco</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => usePreset(p)}
                    className="rounded-md border border-border/70 bg-muted/40 hover:bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Campo de Texto */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="comm-message" className="text-xs font-semibold">
                  Mensagem para o Retorno
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {draftText.length} caracteres · ⌘+Enter envia
                </span>
              </div>
              <Textarea
                id="comm-message"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite a mensagem para o palco (ex.: Pastor chamando no púlpito, abaixe o retorno)..."
                rows={3}
                className="resize-none text-sm font-medium focus-visible:ring-primary"
                autoFocus
              />
            </div>

            {/* Modo de Exibição */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Forma de Exibição no Retorno
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DISPLAY_MODES.map((m) => {
                  const isSelected = displayMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDisplayMode(m.id)}
                      className={cn(
                        "flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border/70 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      <span className="text-xs font-bold leading-tight">
                        {m.label}
                      </span>
                      <span className="text-[10px] opacity-80 mt-1 line-clamp-2">
                        {m.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configurações Adicionais: Urgência, Letreiro Rolante e Timer */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1 border-t border-border/50">
              {/* Nível de Urgência */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Nível de Urgência
                </label>
                <div className="flex flex-col gap-1">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLevel(l.id)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs transition-colors cursor-pointer",
                        level === l.id
                          ? l.activeColor
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="font-medium">{l.label}</span>
                      {level === l.id && (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Animação: Letreiro Rolante */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Tipo de Exibição
                </label>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={!canScroll}
                    onClick={() => setScroll(true)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs transition-colors cursor-pointer",
                      !canScroll && "opacity-40 cursor-not-allowed",
                      scroll && canScroll
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>Letreiro Rolante (D → E)</span>
                    {scroll && canScroll && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScroll(false)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs transition-colors cursor-pointer",
                      !scroll
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>Texto Fixo</span>
                    {!scroll && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              </div>

              {/* Duração / Auto-dismiss */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" />
                  <span>Duração na Tela</span>
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {TIMER_PRESETS.map((t) => (
                    <button
                      key={t.secs}
                      type="button"
                      onClick={() => setAutoDismissSeconds(t.secs)}
                      className={cn(
                        "px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer text-center",
                        autoDismissSeconds === t.secs
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Aba de Histórico de Mensagens Recentes */
          <div className="space-y-2 py-2">
            {history.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                Nenhuma mensagem enviada nesta sessão.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">
                        {item.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                        <span>
                          {new Date(item.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>·</span>
                        <span className="uppercase">{item.displayMode}</span>
                        <span>·</span>
                        <span className="uppercase">{item.level}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 cursor-pointer shrink-0"
                      onClick={() => {
                        setDraftText(item.text);
                        setDisplayMode(item.displayMode);
                        setLevel(item.level);
                        setScroll(item.scroll);
                        setActiveTab("new");
                      }}
                    >
                      <span>Usar</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-4 mt-2">
          {activeAlert ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void clearAlert()}
              className="text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Limpar do Retorno
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeDialog}
              className="text-xs cursor-pointer"
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!draftText.trim()}
              onClick={() => void sendAlert()}
              className="text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="size-3.5" />
              <span>Enviar para o Retorno</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
