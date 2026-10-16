import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Laptop,
  Monitor,
  MonitorUp,
  PowerOff,
  Projector,
  Radio,
  RefreshCw,
  Tv,
} from "lucide-react";
import { outputHttpUrl } from "@/core/config/app";
import {
  fetchServerHost,
  listMonitors,
} from "@/core/ipc/commands";
import type { MonitorInfo, OutputMode, OutputTarget } from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOutputManagerStore } from "@/features/output-manager/store";

interface TargetCardProps {
  target: OutputTarget;
  title: string;
  subtitle: string;
  icon: typeof Projector;
  webPath: "/public" | "/stage";
  monitors: MonitorInfo[];
}

function TargetCard({
  target,
  title,
  subtitle,
  icon: Icon,
  webPath,
  monitors,
}: TargetCardProps) {
  const configs = useOutputManagerStore((s) => s.configs);
  const host = useOutputManagerStore((s) => s.host);
  const setMode = useOutputManagerStore((s) => s.setMode);
  const setMonitor = useOutputManagerStore((s) => s.setMonitor);
  const output = configs[target];

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentUrl = outputHttpUrl(host, webPath);

  async function handleModeChange(mode: OutputMode) {
    setLoading(true);
    try {
      await setMode(target, mode);
    } finally {
      setLoading(false);
    }
  }

  function handleMonitorSelect(monitorId: string | null) {
    void setMonitor(target, monitorId);
  }

  function handleCopyUrl() {
    void navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenUrl() {
    window.open(currentUrl, "_blank");
  }

  const isNative = output.mode === "native" || output.mode === "both";
  const isOff = output.mode === "off";

  return (
    <div className="flex flex-col rounded-xl border border-border/80 bg-card p-5 shadow-2xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-foreground">{title}</h4>
              <Badge
                variant="outline"
                className="font-mono text-[10px] text-muted-foreground"
              >
                {webPath}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
          <span
            className={`size-2 rounded-full ${
              isOff
                ? "bg-zinc-400"
                : isNative
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-sky-500 animate-pulse"
            }`}
          />
          <span className="font-medium capitalize text-[11px] text-foreground">
            {isOff ? "Desativada" : isNative ? "Janela Nativa" : "Saída Web"}
          </span>
        </div>
      </div>

      {/* Mode Controls Segmented */}
      <div className="mt-4 flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">
          Modo de Operação
        </label>
        <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-1">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleModeChange("off")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              isOff
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PowerOff className="size-3.5" />
            Desligada
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleModeChange("native")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              isNative
                ? "bg-background text-primary shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MonitorUp className="size-3.5" />
            Janela Nativa
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleModeChange("web")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              output.mode === "web"
                ? "bg-background text-primary shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio className="size-3.5" />
            Apenas Web
          </button>
        </div>
      </div>

      {/* Monitor Picker (When in native mode) */}
      <div className="mt-4 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">
          Monitor de Exibição Nativa
        </label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-ring"
          value={output.monitorId ?? ""}
          onChange={(e) => handleMonitorSelect(e.target.value || null)}
        >
          <option value="">Detecção automática de monitor</option>
          {monitors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.width}×{m.height}) {m.isPrimary ? "• Principal" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Web URL & Share Bar */}
      <div className="mt-4 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Endereço Web Local (OBS / Celulares / Tablets)
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            porta 5050
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 flex-1 items-center rounded-md border border-input bg-background/80 px-2.5 font-mono text-xs text-foreground select-all">
            <span className="truncate">{currentUrl}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={handleCopyUrl}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copiar
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={handleOpenUrl}
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OutputsTab() {
  const monitors = useOutputManagerStore((s) => s.monitors);
  const host = useOutputManagerStore((s) => s.host);
  const setMonitors = useOutputManagerStore((s) => s.setMonitors);
  const setHost = useOutputManagerStore((s) => s.setHost);

  const [refreshing, setRefreshing] = useState(false);

  async function refreshHardware() {
    setRefreshing(true);
    try {
      const [m, h] = await Promise.all([listMonitors(), fetchServerHost()]);
      setMonitors(m);
      setHost(h);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  useEffect(() => {
    void refreshHardware();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Saídas (telas)
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os monitores físicos conectados via HDMI/DisplayPort e as saídas web locais.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => void refreshHardware()}
          disabled={refreshing}
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? "animate-spin text-primary" : ""}`}
          />
          Detectar Telas
        </Button>
      </div>

      {/* Hardware Displays Overview Banner */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Monitores Físicos Detectados ({monitors.length})
          </span>
          <span className="text-[11px] text-muted-foreground">
            Servidor Local: <code className="font-mono">{host}:5050</code>
          </span>
        </div>

        {monitors.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
            <Laptop className="size-4 shrink-0 text-muted-foreground" />
            <span>
              Nenhum monitor secundário detectado no momento ou em execução via navegador web. Conecte um projetor ou cabo HDMI e clique em &quot;Detectar Telas&quot;.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {monitors.map((m, idx) => (
              <div
                key={m.id || idx}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/90 p-3 shadow-2xs"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <Monitor className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold text-xs text-foreground">
                      {m.name || `Monitor ${idx + 1}`}
                    </p>
                    {m.isPrimary && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[9px] font-medium"
                      >
                        Principal
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.width} × {m.height} px
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target Output Cards Grid */}
      <div className="flex flex-col gap-4">
        <TargetCard
          target="public"
          title="Projeção Pública (Telão)"
          subtitle="Saída principal enviada aos projetores com slides, bíblia e fundos animados."
          icon={Tv}
          webPath="/public"
          monitors={monitors}
        />

        <TargetCard
          target="stage"
          title="Retorno de Palco (Stage Display)"
          subtitle="Saída para a banda e pastores com relógio, próximo slide e alertas de ministração."
          icon={Projector}
          webPath="/stage"
          monitors={monitors}
        />
      </div>
    </div>
  );
}
