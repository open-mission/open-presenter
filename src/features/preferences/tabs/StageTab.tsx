import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Megaphone,
  Monitor,
  Send,
  Smartphone,
  Type,
  Wifi,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { outputHttpUrl } from "@/core/config/app";
import { fetchServerHost } from "@/core/ipc/commands";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useStageDisplayStore } from "@/features/stage-display/store";
import {
  type StageFontSize,
  type StageTheme,
  useStageConfigStore,
} from "@/features/stage-display/configStore";
import { StageMiniPreview } from "@/features/stage-display/StageMiniPreview";
import type { StageAlertLevel, StageMessage } from "@/core/types";

export function StageTab() {
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const setHost = useOutputManagerStore((s) => s.setHost);
  const stageOutput = useOutputManagerStore((s) => s.configs.stage);

  const {
    showClock,
    clock24h,
    showSeconds,
    showTimer,
    showNextUp,
    fontSize,
    theme,
    updateConfig,
  } = useStageConfigStore();

  const messages = useStageDisplayStore((s) => s.messages);
  const pushMessage = useStageDisplayStore((s) => s.pushMessage);
  const dismissMessage = useStageDisplayStore((s) => s.dismissMessage);

  const [copied, setCopied] = useState(false);
  const [alertText, setAlertText] = useState("");
  const [alertLevel, setAlertLevel] = useState<StageAlertLevel>("info");

  useEffect(() => {
    if (host === null) {
      void fetchServerHost()
        .then((h) => setHost(h))
        .catch(() => setHost("localhost"));
    }
  }, [host, setHost]);

  const stageUrl = outputHttpUrl(host, port, "/stage");

  function handleCopy() {
    void navigator.clipboard.writeText(stageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenBrowser() {
    window.open(stageUrl, "_blank");
  }

  function handleSendAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!alertText.trim()) return;

    const msg: StageMessage = {
      id: crypto.randomUUID(),
      text: alertText.trim(),
      level: alertLevel,
      createdAt: new Date().toISOString(),
    };

    pushMessage(msg);
    setAlertText("");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Overview */}
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Tela de Retorno (Stage Display)
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure a página web e monitor de palco para os músicos, ministros e equipe acompanharem a letra e tempo ao vivo.
        </p>
      </div>

      {/* Grid: Settings on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Configuration Controls (7 cols) */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Card 1: Web Access & Connectivity */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="size-4 text-sky-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Acesso Web (Tablets & Celulares)
                </h4>
              </div>
              <Badge
                variant={stageOutput.mode !== "off" ? "default" : "secondary"}
                className={`h-4 text-[9px] font-semibold ${
                  stageOutput.mode !== "off"
                    ? "bg-sky-500 hover:bg-sky-600 text-white"
                    : ""
                }`}
              >
                {stageOutput.mode !== "off" ? "Servidor Ativo" : "Modo Web Disponível"}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Músicos e equipe podem abrir o endereço abaixo em qualquer navegador (iPad, Android, iPhone, TV) na mesma rede Wi-Fi.
            </p>

            {/* URL Display Box */}
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 p-1.5 pl-3">
              <span className="flex-1 select-all font-mono text-xs text-foreground truncate">
                {stageUrl}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3 text-muted-foreground" />
                    <span>Copiar</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 gap-1.5 px-2.5 text-xs shrink-0"
                onClick={handleOpenBrowser}
              >
                <ExternalLink className="size-3" />
                <span>Abrir</span>
              </Button>
            </div>
          </div>

          {/* Card 2: Relógio e Cronômetro */}
          <div className="flex flex-col gap-3.5 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Relógio & Tempo
              </h4>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              {/* Show Clock */}
              <label className="flex items-center justify-between cursor-pointer rounded-lg p-1.5 hover:bg-muted/40 transition-colors">
                <div>
                  <span className="font-medium text-foreground">Exibir Relógio</span>
                  <p className="text-[11px] text-muted-foreground">Mostra a hora atual no topo da tela de retorno</p>
                </div>
                <input
                  type="checkbox"
                  checked={showClock}
                  onChange={(e) => updateConfig({ showClock: e.target.checked })}
                  className="size-4 accent-primary rounded cursor-pointer"
                />
              </label>

              {/* 24h format */}
              {showClock && (
                <label className="flex items-center justify-between cursor-pointer rounded-lg p-1.5 pl-4 hover:bg-muted/40 transition-colors border-l-2 border-border/60 ml-2">
                  <div>
                    <span className="font-medium text-foreground">Formato 24 Horas</span>
                    <p className="text-[11px] text-muted-foreground">Ex: 21:30 em vez de 09:30 PM</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={clock24h}
                    onChange={(e) => updateConfig({ clock24h: e.target.checked })}
                    className="size-4 accent-primary rounded cursor-pointer"
                  />
                </label>
              )}

              {/* Show Seconds */}
              {showClock && (
                <label className="flex items-center justify-between cursor-pointer rounded-lg p-1.5 pl-4 hover:bg-muted/40 transition-colors border-l-2 border-border/60 ml-2">
                  <div>
                    <span className="font-medium text-foreground">Exibir Segundos</span>
                    <p className="text-[11px] text-muted-foreground">Inclui os segundos na contagem do relógio</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={showSeconds}
                    onChange={(e) => updateConfig({ showSeconds: e.target.checked })}
                    className="size-4 accent-primary rounded cursor-pointer"
                  />
                </label>
              )}

              {/* Show Timer / Stopwatch */}
              <label className="flex items-center justify-between cursor-pointer rounded-lg p-1.5 hover:bg-muted/40 transition-colors">
                <div>
                  <span className="font-medium text-foreground">Exibir Cronômetro</span>
                  <p className="text-[11px] text-muted-foreground">Permite cronometrar ministrações e pregações no palco</p>
                </div>
                <input
                  type="checkbox"
                  checked={showTimer}
                  onChange={(e) => updateConfig({ showTimer: e.target.checked })}
                  className="size-4 accent-primary rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Card 3: Tipografia, Tamanho e Próximo Slide */}
          <div className="flex flex-col gap-3.5 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Type className="size-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Letras & Visualização
              </h4>
            </div>

            {/* Font Size Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Tamanho da Fonte das Letras</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "normal", label: "Normal" },
                    { id: "large", label: "Grande" },
                    { id: "xlarge", label: "Extra Grande" },
                  ] as { id: StageFontSize; label: string }[]
                ).map((sizeOpt) => (
                  <button
                    key={sizeOpt.id}
                    type="button"
                    onClick={() => updateConfig({ fontSize: sizeOpt.id })}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      fontSize === sizeOpt.id
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sizeOpt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium text-foreground">Esquema de Cores do Palco</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "classic", label: "Clássico", desc: "Preto & Branco" },
                    { id: "high-contrast", label: "Alto Contraste", desc: "Amarelo / Preto" },
                    { id: "warm", label: "Âmbar Suave", desc: "Tom quente" },
                  ] as { id: StageTheme; label: string; desc: string }[]
                ).map((themeOpt) => (
                  <button
                    key={themeOpt.id}
                    type="button"
                    onClick={() => updateConfig({ theme: themeOpt.id })}
                    className={`flex flex-col items-center rounded-lg border p-2 text-center transition-all ${
                      theme === themeOpt.id
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-xs"
                        : "border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground">{themeOpt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{themeOpt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Show Next Up */}
            <label className="flex items-center justify-between cursor-pointer rounded-lg p-1.5 hover:bg-muted/40 transition-colors pt-2">
              <div>
                <span className="font-medium text-foreground text-xs">Exibir Próximo Slide (Next Up)</span>
                <p className="text-[11px] text-muted-foreground">Mostra a próxima estrofe no rodapé para antecipar a letra</p>
              </div>
              <input
                type="checkbox"
                checked={showNextUp}
                onChange={(e) => updateConfig({ showNextUp: e.target.checked })}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Card 4: Alertas e Mensagens Imediatas ao Palco */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-amber-500" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Enviar Recado ao Palco
              </h4>
            </div>

            <form onSubmit={handleSendAlert} className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Pastor subindo ao altar, microfone sem pilha…"
                  value={alertText}
                  onChange={(e) => setAlertText(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={alertLevel}
                  onChange={(e) => setAlertLevel(e.target.value as StageAlertLevel)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="info">Normal</option>
                  <option value="warning">Aviso</option>
                  <option value="urgent">Urgente</option>
                </select>
                <Button type="submit" size="sm" className="h-8 gap-1.5 px-3 text-xs">
                  <Send className="size-3" />
                  Enviar
                </Button>
              </div>
            </form>

            {/* Active alerts list */}
            {messages.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Recados Ativos no Palco ({messages.length})
                </span>
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1 text-xs"
                    >
                      <span className="truncate">{m.text}</span>
                      <button
                        type="button"
                        onClick={() => dismissMessage(m.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Dispensar recado"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Monitor Preview (5 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-2xs sticky top-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-sky-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Prévia em Tempo Real
                </h4>
              </div>
              <Badge variant="outline" className="h-4 text-[9px]">
                Simulação 16:9
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Veja exatamente como a tela do palco aparece para os músicos conforme você altera as opções:
            </p>

            {/* Simulated Stage Display */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-inner mt-2">
              <StageMiniPreview />
            </div>

            {/* Stage Tips */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 mt-2 text-[11px] text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Smartphone className="size-3.5 text-primary" />
                <span>Dica de uso no palco:</span>
              </div>
              <p>
                Coloque tablets em suportes de pedestais ou microfones. A tela é totalmente responsiva e funciona em orientação retrato ou paisagem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
