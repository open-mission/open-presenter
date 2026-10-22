import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Edit2,
  Megaphone,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Trash2,
  Tv,
  Video,
  X,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/lib/utils";
import { isTauri } from "@/core/ipc/tauri";
import { closeCommunicationWindow } from "@/core/ipc/commands";
import {
  useCommunicationStore,
  useCommunicationSync,
} from "@/features/communication";
import type {
  CommunicationDisplayMode,
  CommunicationLevel,
  CommunicationTarget,
  QuickPreset,
} from "@/features/communication/types";

const DISPLAY_MODES: {
  id: CommunicationDisplayMode;
  label: string;
  description: string;
}[] = [
  {
    id: "banner_top",
    label: "Barra Superior",
    description: "Faixa no topo da tela",
  },
  {
    id: "banner_bottom",
    label: "Barra Inferior",
    description: "Faixa no rodapé da tela",
  },
  {
    id: "overlay",
    label: "Tela Cheia",
    description: "Aviso centralizado em destaque",
  },
  {
    id: "variable_only",
    label: "Apenas Variável",
    description: "Exibe no tema via {stage_message}",
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

export default function CommunicationView() {
  useCommunicationSync();

  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const draftText = useCommunicationStore((s) => s.draftText);
  const setDraftText = useCommunicationStore((s) => s.setDraftText);
  const displayMode = useCommunicationStore((s) => s.displayMode);
  const setDisplayMode = useCommunicationStore((s) => s.setDisplayMode);
  const targets = useCommunicationStore((s) => s.targets);
  const toggleTarget = useCommunicationStore((s) => s.toggleTarget);
  const setTargets = useCommunicationStore((s) => s.setTargets);
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
  const presets = useCommunicationStore((s) => s.presets);
  const usePreset = useCommunicationStore((s) => s.usePreset);
  const addPreset = useCommunicationStore((s) => s.addPreset);
  const updatePreset = useCommunicationStore((s) => s.updatePreset);
  const removePreset = useCommunicationStore((s) => s.removePreset);
  const resetDefaultPresets = useCommunicationStore(
    (s) => s.resetDefaultPresets,
  );
  const sendAlert = useCommunicationStore((s) => s.sendAlert);
  const clearAlert = useCommunicationStore((s) => s.clearAlert);

  // Estado para cadastro/edição de atalho
  const [editingPreset, setEditingPreset] = useState<QuickPreset | null>(null);
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [presetFormLabel, setPresetFormLabel] = useState("");
  const [presetFormText, setPresetFormText] = useState("");
  const [presetFormLevel, setPresetFormLevel] =
    useState<CommunicationLevel>("info");
  const [presetFormMode, setPresetFormMode] =
    useState<CommunicationDisplayMode>("banner_top");
  const [presetFormTargets, setPresetFormTargets] = useState<
    CommunicationTarget[]
  >(["stage"]);

  // Fechar janela com Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isTauri()) {
          void closeCommunicationWindow();
        } else {
          window.close();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const canScroll =
    displayMode === "banner_top" || displayMode === "banner_bottom";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void sendAlert();
    }
  };

  const handleStartCreatePreset = () => {
    setPresetFormLabel("");
    setPresetFormText(draftText || "");
    setPresetFormLevel(level);
    setPresetFormMode(displayMode);
    setPresetFormTargets(targets.length > 0 ? targets : ["stage"]);
    setEditingPreset(null);
    setIsCreatingPreset(true);
  };

  const handleStartEditPreset = (p: QuickPreset) => {
    setEditingPreset(p);
    setPresetFormLabel(p.label);
    setPresetFormText(p.text);
    setPresetFormLevel(p.level);
    setPresetFormMode(p.displayMode);
    setPresetFormTargets(p.targets && p.targets.length > 0 ? p.targets : ["stage"]);
    setIsCreatingPreset(true);
  };

  const handleSavePreset = () => {
    if (!presetFormLabel.trim() || !presetFormText.trim()) return;

    if (editingPreset) {
      updatePreset(editingPreset.id, {
        label: presetFormLabel.trim(),
        text: presetFormText.trim(),
        level: presetFormLevel,
        displayMode: presetFormMode,
        targets: presetFormTargets.length > 0 ? presetFormTargets : ["stage"],
        scroll: presetFormMode === "banner_top" || presetFormMode === "banner_bottom",
      });
    } else {
      const newPreset: QuickPreset = {
        id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: presetFormLabel.trim(),
        text: presetFormText.trim(),
        level: presetFormLevel,
        displayMode: presetFormMode,
        targets: presetFormTargets.length > 0 ? presetFormTargets : ["stage"],
        scroll: presetFormMode === "banner_top" || presetFormMode === "banner_bottom",
      };
      addPreset(newPreset);
    }

    setIsCreatingPreset(false);
    setEditingPreset(null);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Barra de Título Superior */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-muted/20 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background shadow-xs">
            <BrandMark className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">
              Painel de Comunicação & Avisos
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Transmissão de mensagens em tempo real para saídas de vídeo
            </p>
          </div>
        </div>

        {/* Indicador de Alerta Ativo */}
        <div className="flex items-center gap-3">
          {activeAlert && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
              </span>
              <span className="font-semibold text-amber-300">No Ar:</span>
              <span className="max-w-[200px] truncate text-foreground font-medium">
                "{activeAlert.text}"
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-6 text-[11px] gap-1 px-2 cursor-pointer ml-1"
                onClick={() => void clearAlert()}
              >
                <Trash2 className="size-3" />
                <span>Limpar</span>
              </Button>
            </div>
          )}

          {isTauri() && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => void closeCommunicationWindow()}
              title="Fechar janela (Esc)"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Corpo Dividido: Janela Avisos (Esquerda) | Atalhos 4x2 (Direita) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel Esquerdo: Composição do Aviso */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 border-r border-border/80">
          {/* Campo de Texto da Mensagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="comm-text" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Megaphone className="size-3.5 text-primary" />
                <span>Texto do Aviso</span>
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {draftText.length} caracteres · ⌘+Enter envia
              </span>
            </div>
            <Textarea
              id="comm-text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite a mensagem para os monitores (ex.: Pastor chamando no altar, favor abaixar o volume)..."
              rows={3}
              className="resize-none text-sm font-medium focus-visible:ring-primary shadow-xs"
              autoFocus
            />
          </div>

          {/* Saídas de Destino (Multi-seleção) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground">
                Saídas de Destino do Aviso
              </label>
              <button
                type="button"
                onClick={() => setTargets(["stage", "public", "stream"])}
                className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
              >
                Selecionar Todas
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Retorno (Stage) */}
              <button
                type="button"
                onClick={() => toggleTarget("stage")}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer text-xs font-semibold",
                  targets.includes("stage")
                    ? "border-sky-500 bg-sky-950/40 text-sky-200 shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Tv className="size-4" />
                  <span>Retorno (Palco)</span>
                </div>
                {targets.includes("stage") && <Check className="size-3.5 text-sky-400" />}
              </button>

              {/* Telão (Público) */}
              <button
                type="button"
                onClick={() => toggleTarget("public")}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer text-xs font-semibold",
                  targets.includes("public")
                    ? "border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Radio className="size-4" />
                  <span>Telão (Público)</span>
                </div>
                {targets.includes("public") && <Check className="size-3.5 text-emerald-400" />}
              </button>

              {/* OBS / Transmissão */}
              <button
                type="button"
                onClick={() => toggleTarget("stream")}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer text-xs font-semibold",
                  targets.includes("stream")
                    ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Video className="size-4" />
                  <span>OBS (Live)</span>
                </div>
                {targets.includes("stream") && <Check className="size-3.5 text-purple-400" />}
              </button>
            </div>
          </div>

          {/* Forma de Exibição */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              Forma de Exibição
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

          {/* Urgência, Animação e Duração */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1 border-t border-border/50">
            {/* Nível de Urgência */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
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

            {/* Letreiro Rolante vs Fixo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Animação
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

            {/* Duração na Tela */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
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

          {/* Botões de Ação do Envio */}
          <div className="flex items-center justify-between pt-3 border-t border-border/80">
            {activeAlert ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void clearAlert()}
                className="text-xs cursor-pointer gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Limpar do Ar</span>
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="button"
              size="default"
              disabled={!draftText.trim()}
              onClick={() => void sendAlert()}
              className="gap-2 px-6 font-bold cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              <Send className="size-4" />
              <span>Enviar Aviso para as Saídas (⌘Enter)</span>
            </Button>
          </div>
        </div>

        {/* Painel Direito: Atalhos Rápidos (Grade 4x2) & Configuração */}
        <aside className="w-[380px] sm:w-[420px] shrink-0 bg-muted/15 flex flex-col overflow-hidden">
          {/* Cabeçalho do Painel de Atalhos */}
          <div className="flex items-center justify-between p-3.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Zap className="size-4 text-amber-400" />
              <h2 className="text-xs font-bold text-foreground">
                Atalhos Rápidos ({presets.length})
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2 cursor-pointer"
                onClick={handleStartCreatePreset}
                title="Cadastrar novo atalho rápido"
              >
                <Plus className="size-3" />
                <span>Novo</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={resetDefaultPresets}
                title="Restaurar atalhos padrões"
              >
                <RotateCcw className="size-3" />
              </Button>
            </div>
          </div>

          {/* Formulário de Criação / Edição de Atalho (quando ativo) */}
          {isCreatingPreset ? (
            <div className="p-3.5 bg-background border-b border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {editingPreset ? "Editar Atalho" : "Cadastrar Novo Atalho"}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6 cursor-pointer"
                  onClick={() => setIsCreatingPreset(false)}
                >
                  <X className="size-3" />
                </Button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">
                  Nome do Atalho (ex.: Pastor chamando)
                </label>
                <Input
                  value={presetFormLabel}
                  onChange={(e) => setPresetFormLabel(e.target.value)}
                  placeholder="Nome curto do botão..."
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">
                  Texto Completo do Aviso
                </label>
                <Textarea
                  value={presetFormText}
                  onChange={(e) => setPresetFormText(e.target.value)}
                  placeholder="Mensagem completa..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">
                    Nível de Urgência
                  </label>
                  <select
                    value={presetFormLevel}
                    onChange={(e) =>
                      setPresetFormLevel(e.target.value as CommunicationLevel)
                    }
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="info">Normal / Info</option>
                    <option value="warning">Atenção</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">
                    Modo
                  </label>
                  <select
                    value={presetFormMode}
                    onChange={(e) =>
                      setPresetFormMode(e.target.value as CommunicationDisplayMode)
                    }
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="banner_top">Barra Topo</option>
                    <option value="banner_bottom">Barra Rodapé</option>
                    <option value="overlay">Tela Cheia</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">
                  Saídas de Destino
                </label>
                <div className="flex gap-1.5">
                  {(["stage", "public", "stream"] as const).map((tgt) => (
                    <button
                      key={tgt}
                      type="button"
                      onClick={() =>
                        setPresetFormTargets((prev) =>
                          prev.includes(tgt)
                            ? prev.length > 1
                              ? prev.filter((t) => t !== tgt)
                              : prev
                            : [...prev, tgt],
                        )
                      }
                      className={cn(
                        "flex-1 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer text-center",
                        presetFormTargets.includes(tgt)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {tgt === "stage"
                        ? "Palco"
                        : tgt === "public"
                        ? "Telão"
                        : "OBS"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs cursor-pointer"
                  onClick={() => setIsCreatingPreset(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs font-semibold cursor-pointer"
                  disabled={!presetFormLabel.trim() || !presetFormText.trim()}
                  onClick={handleSavePreset}
                >
                  Salvar Atalho
                </Button>
              </div>
            </div>
          ) : null}

          {/* Grade 4x2 de Atalhos (2 colunas, scrollável verticalmente) */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => {
                const isUrgent = preset.level === "urgent";
                const isWarning = preset.level === "warning";

                return (
                  <div
                    key={preset.id}
                    className={cn(
                      "group relative flex flex-col justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer hover:border-foreground/40 hover:shadow-xs",
                      isUrgent
                        ? "border-red-500/40 bg-red-950/15"
                        : isWarning
                        ? "border-amber-500/40 bg-amber-950/15"
                        : "border-border/70 bg-card hover:bg-muted/40",
                    )}
                    onClick={() => usePreset(preset)}
                  >
                    <div>
                      {/* Topo do card com nível e ações rápidas */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            isUrgent
                              ? "bg-red-500 animate-pulse"
                              : isWarning
                              ? "bg-amber-500"
                              : "bg-sky-500",
                          )}
                        />
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditPreset(preset);
                            }}
                            title="Editar atalho"
                          >
                            <Edit2 className="size-2.5" />
                          </button>
                          <button
                            type="button"
                            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePreset(preset.id);
                            }}
                            title="Excluir atalho"
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-bold leading-tight text-foreground line-clamp-1">
                        {preset.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1 leading-snug">
                        {preset.text}
                      </p>
                    </div>

                    {/* Rodapé do card: Badges de saídas */}
                    <div className="flex flex-wrap items-center gap-1 mt-2 pt-1 border-t border-border/40 text-[9px] font-mono text-muted-foreground">
                      {(preset.targets ?? ["stage"]).map((t) => (
                        <span
                          key={t}
                          className="px-1 rounded bg-muted/60 uppercase font-semibold text-[8px]"
                        >
                          {t === "stage" ? "Palco" : t === "public" ? "Telão" : "OBS"}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
