import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Palette,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Sliders,
  Smartphone,
  Square,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { outputHttpUrl } from "@/core/config/app";
import type { ConnectedClient } from "@/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getConnectedClients,
  openDisplaysWindow,
  saveThemeMedia,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import { useDisplaysStore } from "@/features/displays/store";
import {
  resolveThemeMediaUrl,
  parseMediaWithFit,
  FIT_CLASSES,
  type MediaFit,
} from "@/features/theme-editor/media";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { usePreferencesStore } from "@/features/preferences/store";
import type { OutputsSection } from "@/features/preferences/types";
import { useOutputThemeDocument } from "@/features/slide-themes/useOutputPlan";

const FIT_OPTIONS: { id: MediaFit; label: string; desc: string }[] = [
  { id: "contain", label: "Ajustar", desc: "Exibe a imagem inteira sem cortes (com barras se necessário)" },
  { id: "cover", label: "Preencher", desc: "Cobre toda a tela mantendo proporção (corta bordas)" },
  { id: "scale-down", label: "Centralizar", desc: "Mantém resolução original centralizada" },
  { id: "fill", label: "Esticar", desc: "Estica preenchendo toda a tela (pode distorcer)" },
];

function PublicWallpaperCard() {
  const wallpaper = useOutputManagerStore((s) => s.configs.public.wallpaper);
  const setWallpaper = useOutputManagerStore((s) => s.setWallpaper);
  const themeName = useOutputThemeDocument("public").title;

  const [uploading, setUploading] = useState(false);
  const [wallpaperError, setWallpaperError] = useState(false);

  useEffect(() => {
    setWallpaperError(false);
  }, [wallpaper]);

  async function handleWallpaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeName = `wallpaper_${Date.now()}.${ext}`;
      const saved = await saveThemeMedia("wallpapers", safeName, Array.from(bytes));
      const currentFit = wallpaper ? parseMediaWithFit(wallpaper).fit : "contain";
      await setWallpaper("public", `${saved}#fit=${currentFit}`);
      toast.success("Papel de parede definido com sucesso!");
    } catch (err) {
      console.warn("Falha ao salvar via saveThemeMedia, aplicando data URL:", err);
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          const currentFit = wallpaper ? parseMediaWithFit(wallpaper).fit : "contain";
          await setWallpaper("public", `${reader.result}#fit=${currentFit}`);
          toast.success("Papel de parede definido com sucesso!");
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleFitChange(fit: MediaFit) {
    if (!wallpaper) return;
    const { url } = parseMediaWithFit(wallpaper);
    void setWallpaper("public", `${url}#fit=${fit}`);
    const fitLabel = FIT_OPTIONS.find((o) => o.id === fit)?.label ?? fit;
    toast.info(`Ajuste alterado para: ${fitLabel}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-5 shadow-2xs mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">
            Papel de Parede (Tela Livre)
          </h4>
        </div>
        {wallpaper && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void setWallpaper("public", null)}
            className="h-7 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <Trash2 className="size-3.5 mr-1" />
            Remover Imagem
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Exibido no telão em proporção 16:9 quando nada estiver em apresentação ou quando a projeção estiver desocupada.
      </p>

      {/* Preview Box */}
      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border border-border bg-black shadow-inner">
        {wallpaper ? (
          (() => {
            const { url, fit } = parseMediaWithFit(wallpaper);
            const resolvedUrl = resolveThemeMediaUrl(url);
            if (wallpaperError) {
              return (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center text-muted-foreground select-none">
                  <TriangleAlert className="size-8 text-amber-500/80" />
                  <span className="text-xs font-medium text-foreground/80">
                    Arquivo não encontrado
                  </span>
                </div>
              );
            }
            return (
              <img
                src={resolvedUrl}
                alt="Papel de parede"
                className={`h-full w-full ${FIT_CLASSES[fit]}`}
                onError={() => setWallpaperError(true)}
              />
            );
          })()
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center text-muted-foreground select-none">
            <ImageIcon className="size-8 text-muted-foreground/30" />
            <span className="text-xs font-medium text-foreground/80">
              Nenhum papel de parede definido
            </span>
            <span className="text-[10px] text-muted-foreground">
              O telão permanecerá preto enquanto estiver livre.
            </span>
          </div>
        )}
      </div>

      {/* Controls: Upload & Object-Fit */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleWallpaperUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground shadow-2xs hover:bg-secondary/80">
              <Upload className="size-3.5" />
              {uploading ? "Salvando…" : wallpaper ? "Trocar Imagem" : "Escolher Imagem"}
            </span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            Formatos recomendados: PNG, JPG ou WebP (1920×1080).
          </span>
        </div>

        {wallpaper && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
            <span className="text-[11px] font-medium text-foreground">
              Ajuste na Tela (Object Fit)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-1 max-w-md">
              {FIT_OPTIONS.map((opt) => {
                const currentFit = parseMediaWithFit(wallpaper).fit;
                const selected = currentFit === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleFitChange(opt.id)}
                    className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      selected
                        ? "bg-background text-primary shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/40 pt-2">
        <Palette className="size-3.5 shrink-0" />
        <span className="font-medium">Tema atual da projeção:</span>
        <span className="truncate text-foreground font-semibold">
          {themeName ?? "Padrão"}
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

  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  async function handleOpenUrl(url: string) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  }

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

      <div className={`flex min-w-0 flex-col gap-2.5 ${server.running ? "" : "opacity-50"}`}>
        {[
          { label: "Projeção pública", url: publicUrl },
          { label: "Retorno de palco", url: stageUrl },
        ].map((item) => {
          const isCopied = copiedUrl === item.url;
          return (
            <div key={item.url} className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {item.label}
              </span>
              <div className="flex min-w-0 items-center rounded-md border border-input bg-background/80 shadow-2xs focus-within:ring-1 focus-within:ring-ring">
                <input
                  type="text"
                  readOnly
                  value={item.url}
                  className="h-8 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-xs text-foreground outline-none select-all"
                />
                <div className="flex shrink-0 items-center gap-1 border-l border-border/60 px-1 py-1 bg-muted/20">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-xs font-medium cursor-pointer"
                    disabled={!server.running}
                    onClick={() => {
                      void navigator.clipboard.writeText(item.url);
                      setCopiedUrl(item.url);
                      setTimeout(() => setCopiedUrl(null), 2000);
                    }}
                    title={server.running ? "Copiar endereço" : "Servidor local parado"}
                  >
                    {isCopied ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-6 gap-1 px-2 text-xs font-medium cursor-pointer"
                    disabled={!server.running}
                    onClick={() => void handleOpenUrl(item.url)}
                    title={server.running ? "Abrir no navegador" : "Servidor local parado"}
                  >
                    <ExternalLink className="size-3" />
                    <span>Abrir</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DevicesSection() {
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [busy, setBusy] = useState(false);

  async function refreshClients() {
    setBusy(true);
    try {
      setClients(await getConnectedClients());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshClients();
    const interval = setInterval(() => void refreshClients(), 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="size-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">Dispositivos Conectados</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Navegadores e telas remotas sincronizados com esta máquina via WebSocket.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => void refreshClients()}
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="p-6 text-center rounded-lg border border-dashed border-border/80 bg-muted/10 text-xs text-muted-foreground">
          Nenhum dispositivo conectado no momento.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="pb-2 font-medium">IP</th>
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium">Saída</th>
                <th className="pb-2 font-medium">Navegador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 font-mono text-foreground">{c.ip}</td>
                  <td className="py-2 capitalize">{c.kind}</td>
                  <td className="py-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {c.output ?? "Indefinida"}
                    </Badge>
                  </td>
                  <td className="py-2 text-muted-foreground truncate max-w-[200px]" title={c.userAgent ?? ""}>
                    {c.userAgent ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function OutputsTab() {
  const monitors = useOutputManagerStore((s) => s.monitors);
  const loaded = useOutputManagerStore((s) => s.loaded);
  const load = useOutputManagerStore((s) => s.load);
  const refreshRuntime = useOutputManagerStore((s) => s.refreshRuntime);
  const section = usePreferencesStore((s) => s.outputsSection);
  const setSection = usePreferencesStore((s) => s.setOutputsSection);

  const displaysSettings = useDisplaysStore((s) => s.settings);
  const updateDisplaysSettings = useDisplaysStore((s) => s.updateSettings);
  const configuredOutputs = useDisplaysStore((s) => s.outputs);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
    else void refreshRuntime();
  }, [loaded, load, refreshRuntime]);

  async function refreshHardware() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  async function handleOpenDisplays() {
    if (isTauri()) {
      await openDisplaysWindow();
    } else {
      window.open("#/displays", "_blank");
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
            Configure saídas de projeção física, retorno de palco, stream OBS (HTML) e servidor web local.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            onClick={() => void handleOpenDisplays()}
          >
            <Sliders className="size-3.5" />
            Configurar telas... ({configuredOutputs.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs shrink-0 cursor-pointer"
            onClick={() => void refreshHardware()}
            disabled={refreshing}
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin text-primary" : ""}`}
            />
            Detectar ({monitors.length})
          </Button>
        </div>
      </div>

      {/* ProPresenter Screen Preferences Card (matching CleanShot 2026-10-22 at 21.53.57@2x.png) */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-5">
        <div className="space-y-4">
          {/* Switch 1: Ativar telas automaticamente */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label
                htmlFor="auto-activate"
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                Ativar telas automaticamente na inicialização
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Quando o aplicativo for iniciado, ative automaticamente as telas de palco e público. Esta configuração afeta apenas as saídas gráficas.
              </p>
            </div>
            <Switch
              id="auto-activate"
              checked={displaysSettings.autoActivateOnLaunch}
              onCheckedChange={(checked) =>
                void updateDisplaysSettings({ autoActivateOnLaunch: checked })
              }
              className="scale-90 shrink-0"
            />
          </div>

          <div className="h-px bg-border/50" />

          {/* Switch 2: Exibir estatísticas de desempenho */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label
                htmlFor="perf-stats"
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                Exibir estatísticas de desempenho na tela
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A ativação exibirá os quadros renderizados por segundo (FPS) e a utilização de memória de vídeo em todas as telas.
              </p>
            </div>
            <Switch
              id="perf-stats"
              checked={displaysSettings.showPerformanceStats}
              onCheckedChange={(checked) =>
                void updateDisplaysSettings({ showPerformanceStats: checked })
              }
              className="scale-90 shrink-0"
            />
          </div>

          <div className="h-px bg-border/50" />

          {/* Switch 3: Ignorar cores de fundo */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label
                htmlFor="ignore-bg"
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                Ignorar cores de fundo
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Ignora as cores de fundo da apresentação e do slide para todo o conteúdo renderizado.
              </p>
            </div>
            <Switch
              id="ignore-bg"
              checked={displaysSettings.ignoreBackgroundColors}
              onCheckedChange={(checked) =>
                void updateDisplaysSettings({ ignoreBackgroundColors: checked })
              }
              className="scale-90 shrink-0"
            />
          </div>

          <div className="h-px bg-border/50" />

          {/* Switch 4: Mostrar telas de Keynote */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label
                htmlFor="keynote-screens"
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                Mostrar telas de Keynote
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exibir telas de apresentação de Keynote / PowerPoint, mesmo quando a projeção estiver ativa.
              </p>
            </div>
            <Switch
              id="keynote-screens"
              checked={displaysSettings.showKeynoteScreens}
              onCheckedChange={(checked) =>
                void updateDisplaysSettings({ showKeynoteScreens: checked })
              }
              className="scale-90 shrink-0"
            />
          </div>
        </div>

        {/* Renderização Group */}
        <div className="pt-2 border-t border-border/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Renderização
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Fonte de cronômetro
              </label>
              <Select
                value={displaysSettings.timerFontMode}
                onValueChange={(val) =>
                  void updateDisplaysSettings({ timerFontMode: val })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="mono">Monospace</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Profundidade de Bit
              </label>
              <Select
                value={displaysSettings.bitDepth}
                onValueChange={(val) =>
                  void updateDisplaysSettings({ bitDepth: val })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8bit">Normal (8-bit)</SelectItem>
                  <SelectItem value="10bit">Profundo (10-bit HDR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground leading-normal">
            Aumentar a profundidade de bit irá melhorar a qualidade de renderização, mas também requer significativamente mais processamento do computador. Esta alteração requer uma reinicialização da aplicação.
          </p>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleOpenDisplays()}
              className="h-8 px-4 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 gap-1.5 cursor-pointer shadow-sm"
            >
              <Sliders className="size-3.5" />
              Configurar telas...
            </Button>
          </div>
        </div>
      </div>

      {/* Abas de Rede, Servidor e Papel de Parede */}
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as OutputsSection)}
        className="flex flex-col gap-4"
      >
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="server" className="gap-1.5 text-xs">
            <Server className="size-3.5" />
            Servidor Local
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5 text-xs">
            <Smartphone className="size-3.5" />
            Dispositivos Conectados
          </TabsTrigger>
          <TabsTrigger value="wallpaper" className="gap-1.5 text-xs">
            <ImageIcon className="size-3.5" />
            Papel de Parede do Telão
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Servidor Local */}
        <TabsContent value="server">
          <ServerSection />
        </TabsContent>

        {/* Tab 2: Dispositivos Conectados */}
        <TabsContent value="devices">
          <DevicesSection />
        </TabsContent>

        {/* Tab 3: Papel de Parede do Telão */}
        <TabsContent value="wallpaper">
          <PublicWallpaperCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
