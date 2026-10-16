import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Laptop,
  Layers,
  Monitor,
  MonitorUp,
  Palette,
  Play,
  Power,
  PowerOff,
  Projector,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  Smartphone,
  Square,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { outputHttpUrl } from "@/core/config/app";
import type {
  ConnectedClient,
  MonitorInfo,
  OutputMode,
  OutputTarget,
} from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConnectedClients } from "@/core/ipc/commands";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useSlideThemesStore } from "@/features/slide-themes/store";

const TARGET_LABEL: Record<OutputTarget, string> = {
  public: "Projeção Pública",
  stage: "Retorno de Palco",
};

const MODE_OPTIONS: { id: OutputMode; label: string; icon: typeof PowerOff }[] = [
  { id: "off", label: "Desligada", icon: PowerOff },
  { id: "native", label: "Nativa", icon: MonitorUp },
  { id: "web", label: "Web", icon: Radio },
  { id: "both", label: "Ambas", icon: Layers },
];

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
  const config = useOutputManagerStore((s) => s.configs[target]);
  const live = useOutputManagerStore((s) => s.runtime[target]);
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const setMode = useOutputManagerStore((s) => s.setMode);
  const setMonitor = useOutputManagerStore((s) => s.setMonitor);
  const toggle = useOutputManagerStore((s) => s.toggle);
  const themeName = useSlideThemesStore((s) => {
    if (target === "stage") {
      const guid = s.stageThemeGuid;
      return s.themes.find((t) => t.guid === guid)?.title ?? null;
    }
    const binding =
      s.bindings.find((b) => b.target === "public" && b.asset === "lyric") ??
      s.bindings.find((b) => b.target === "public");
    if (!binding) return null;
    return s.themes.find((t) => t.guid === binding.themeGuid)?.title ?? null;
  });

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentUrl = outputHttpUrl(host, port, webPath);
  const powered = config.mode !== "off";
  const active =
    powered && (config.mode === "web" || live.open);
  const savedMissing =
    config.monitorId !== null &&
    !monitors.some((m) => m.id === config.monitorId);

  async function handleModeChange(mode: OutputMode) {
    if (mode === config.mode) return;
    setBusy(true);
    try {
      await setMode(target, mode);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle() {
    setBusy(true);
    try {
      await toggle(target);
    } finally {
      setBusy(false);
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

        <div className="flex shrink-0 items-center gap-2">
          {/* Real-state pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
            <span
              className={`size-2 rounded-full ${
                active ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              }`}
            />
            <span className="font-medium capitalize text-[11px] text-foreground">
              {active ? "Ativa" : "Desligada"}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant={active ? "secondary" : "default"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => void handleToggle()}
            disabled={busy}
            title={
              active
                ? "Desligar saída"
                : config.mode === "off"
                  ? "Ligar saída no último modo usado"
                  : "Reabrir janela nativa"
            }
          >
            <Power className="size-3.5" />
            {active ? "Desligar" : "Ligar"}
          </Button>
        </div>
      </div>

      {/* Mode Controls Segmented */}
      <div className="mt-4 flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">
          Modo de Operação
        </label>
        <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-1">
          {MODE_OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            const selected = config.mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => void handleModeChange(option.id)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  selected
                    ? "bg-background text-primary shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <OptionIcon className="size-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monitor Picker */}
      <div className="mt-4 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">
          Monitor de Exibição Nativa
        </label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-ring"
          value={config.monitorId ?? ""}
          disabled={busy}
          onChange={(e) => handleMonitorSelect(e.target.value || null)}
        >
          <option value="">Detecção automática de monitor</option>
          {savedMissing && (
            <option value={config.monitorId ?? ""}>
              {config.monitorLabel ?? config.monitorId} — não conectado
            </option>
          )}
          {monitors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.width}×{m.height}) {m.isPrimary ? "• Principal" : ""}
            </option>
          ))}
        </select>
        {savedMissing && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
            <TriangleAlert className="size-3.5 shrink-0" />
            Monitor salvo não conectado — a janela nativa não abre até
            reconectar ou trocar de monitor.
          </p>
        )}
      </div>

      {/* Web URL & Share Bar */}
      <div className="mt-4 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Endereço Web Local (OBS / Celulares / Tablets)
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            porta {port}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 flex-1 items-center rounded-md border border-input bg-background/80 px-2.5 font-mono text-xs text-foreground select-all ${
              serverRunning ? "" : "opacity-50"
            }`}
          >
            <span className="truncate">{currentUrl}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={handleCopyUrl}
            disabled={!serverRunning}
            title={serverRunning ? "Copiar endereço" : "Servidor local parado"}
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
            disabled={!serverRunning}
            title={serverRunning ? "Abrir no navegador" : "Servidor local parado"}
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </Button>
        </div>
      </div>

      {/* Current theme (read-only) */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Palette className="size-3.5 shrink-0" />
        <span className="font-medium">Tema atual:</span>
        <span className="truncate text-foreground">
          {themeName ?? "Nenhum tema ligado"}
        </span>
      </div>
    </div>
  );
}

function ServerSection() {
  const host = useOutputManagerStore((s) => s.host);
  const server = useOutputManagerStore((s) => s.server);
  const setPort = useOutputManagerStore((s) => s.setPort);
  const stopLocalServer = useOutputManagerStore((s) => s.stopLocalServer);
  const startLocalServer = useOutputManagerStore((s) => s.startLocalServer);
  const restartLocalServer = useOutputManagerStore((s) => s.restartLocalServer);

  const [portInput, setPortInput] = useState(String(server.port));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPortInput(String(server.port));
  }, [server.port]);

  const publicUrl = outputHttpUrl(host, server.port, "/public");
  const stageUrl = outputHttpUrl(host, server.port, "/stage");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleApplyPort() {
    const port = Number(portInput);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      setError("Porta inválida — use um número entre 1024 e 65535.");
      return;
    }
    void run(() => setPort(port));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server className="size-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">Servidor local</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Serve as saídas web (OBS, celulares, tablets) na rede local.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
          <span
            className={`size-2 rounded-full ${
              server.running ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
            }`}
          />
          <span className="font-medium capitalize text-[11px] text-foreground">
            {server.running ? `Ativo · ${host}:${server.port}` : "Parado"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground" htmlFor="server-port">
            Porta
          </label>
          <input
            id="server-port"
            type="number"
            min={1024}
            max={65535}
            value={portInput}
            disabled={busy}
            onChange={(e) => setPortInput(e.target.value)}
            className="h-8 w-28 rounded-md border border-input bg-background px-2.5 font-mono text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-1.5 text-xs"
          onClick={handleApplyPort}
          disabled={busy}
          title="Salvar a porta e reiniciar o servidor"
        >
          <Check className="size-3.5" />
          Aplicar porta
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void run(() => restartLocalServer())}
          disabled={busy || !server.running}
          title="Reiniciar o servidor local"
        >
          <RotateCcw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          Reiniciar
        </Button>
        {server.running ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void run(() => stopLocalServer())}
            disabled={busy}
            title="Parar o servidor local"
          >
            <Square className="size-3.5" />
            Parar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void run(() => startLocalServer())}
            disabled={busy}
            title="Iniciar o servidor local"
          >
            <Play className="size-3.5" />
            Iniciar
          </Button>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-500">
          <TriangleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className={`flex flex-col gap-1.5 ${server.running ? "" : "opacity-50"}`}>
        {[
          { label: "Projeção pública", url: publicUrl },
          { label: "Retorno de palco", url: stageUrl },
        ].map((item) => (
          <div key={item.url} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[11px] font-medium text-muted-foreground">
              {item.label}
            </span>
            <div className="flex h-8 flex-1 items-center rounded-md border border-input bg-background/80 px-2.5 font-mono text-xs text-foreground select-all">
              <span className="truncate">{item.url}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-2.5 text-xs"
              disabled={!server.running}
              onClick={() => void navigator.clipboard.writeText(item.url)}
              title={server.running ? "Copiar endereço" : "Servidor local parado"}
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 px-2.5 text-xs"
              disabled={!server.running}
              onClick={() => window.open(item.url, "_blank")}
              title={server.running ? "Abrir no navegador" : "Servidor local parado"}
            >
              <ExternalLink className="size-3.5" />
              Abrir
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatClientTime(epochSecs: number): string {
  const date = new Date(epochSecs * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DevicesSection() {
  const runtime = useOutputManagerStore((s) => s.runtime);
  const configs = useOutputManagerStore((s) => s.configs);
  const monitors = useOutputManagerStore((s) => s.monitors);
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let disposed = false;
    async function load(): Promise<void> {
      const list = await getConnectedClients();
      if (!disposed) setClients(list);
    }
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      setClients(await getConnectedClients());
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  const nativeOpen = (["public", "stage"] as const).filter(
    (t) => runtime[t]?.open,
  );
  const empty = nativeOpen.length === 0 && clients.length === 0;

  function monitorLabel(target: OutputTarget): string {
    const id = runtime[target]?.monitorId;
    return (
      monitors.find((m) => m.id === id)?.name ??
      configs[target].monitorLabel ??
      "Detecção automática"
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="size-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">
              Dispositivos conectados
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Janelas nativas abertas e navegadores web ligados às saídas.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1.5 text-xs"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          title="Atualizar lista de dispositivos"
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? "animate-spin text-primary" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      {empty ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <Smartphone className="size-4 shrink-0 text-muted-foreground" />
          <span>
            Nenhum dispositivo conectado. Abra uma saída web em um celular,
            tablet ou OBS para vê-lo aqui.
          </span>
        </div>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Dispositivo</th>
              <th className="py-2 pr-2 font-medium">Saída</th>
              <th className="py-2 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {nativeOpen.map((t) => (
              <tr
                key={`native-${t}`}
                className="border-b border-border/40 last:border-0"
              >
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Monitor className="size-3.5 shrink-0 text-muted-foreground" />
                    Janela nativa
                  </span>
                </td>
                <td className="py-2 pr-2 text-foreground">{TARGET_LABEL[t]}</td>
                <td className="py-2 text-muted-foreground">
                  {monitorLabel(t)}
                </td>
              </tr>
            ))}
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Smartphone className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-mono">{c.ip}</span>
                  </span>
                </td>
                <td className="py-2 pr-2 text-foreground">
                  {c.output ? TARGET_LABEL[c.output] : "—"}
                </td>
                <td className="py-2 text-muted-foreground">
                  {formatClientTime(c.connectedAt)}
                  {c.userAgent ? ` · ${c.userAgent}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function OutputsTab() {
  const monitors = useOutputManagerStore((s) => s.monitors);
  const runtime = useOutputManagerStore((s) => s.runtime);
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const loaded = useOutputManagerStore((s) => s.loaded);
  const load = useOutputManagerStore((s) => s.load);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  async function refreshHardware() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }

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
            Servidor Local: <code className="font-mono">{host}:{port}</code>
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
            {monitors.map((m, idx) => {
              const users = (["public", "stage"] as const).filter(
                (t) => runtime[t].monitorId === m.id,
              );
              return (
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
                    {users.length > 0 && (
                      <Badge
                        variant="outline"
                        className="mt-1 h-4 px-1 text-[9px] font-medium text-emerald-600 dark:text-emerald-500"
                      >
                        em uso por{" "}
                        {users.map((t) => TARGET_LABEL[t]).join(" e ")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Output Cards Grid */}
      <div className="flex flex-col gap-4">
        <ServerSection />

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

        <DevicesSection />
      </div>
    </div>
  );
}
