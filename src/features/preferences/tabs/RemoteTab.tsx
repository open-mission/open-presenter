import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Smartphone,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/core/lib/utils";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { useRemoteStore } from "@/features/remote/store";

function copyText(value: string, label: string): void {
  if (!value) return;
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copiado.`))
    .catch(() => toast.error("Não foi possível copiar."));
}

export function RemoteTab() {
  const config = useRemoteStore((s) => s.config);
  const loading = useRemoteStore((s) => s.loading);
  const error = useRemoteStore((s) => s.error);
  const ensureToken = useRemoteStore((s) => s.ensureToken);
  const setEnabled = useRemoteStore((s) => s.setEnabled);
  const regenerateToken = useRemoteStore((s) => s.regenerateToken);

  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);
  const serverRunning = useOutputManagerStore((s) => s.server.running);
  const startServer = useOutputManagerStore((s) => s.startLocalServer);

  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    void ensureToken();
  }, [ensureToken]);

  const token = config?.token ?? "";
  const enabled = config?.enabled ?? false;
  const remoteHost = host || "localhost";
  const remoteUrl = useMemo(
    () =>
      token
        ? `http://${remoteHost}:${port}/#/remote?token=${encodeURIComponent(token)}`
        : "",
    [remoteHost, port, token],
  );

  async function handleCopyUrl() {
    copyText(remoteUrl, "Link");
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  }

  async function handleCopyToken() {
    copyText(token, "Token");
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1500);
  }

  async function handleRegenerate() {
    if (!confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }
    setConfirmRegenerate(false);
    const ok = await regenerateToken();
    if (ok) {
      toast.success("Novo token gerado. Dispositivos antigos foram desconectados.");
    } else {
      toast.error("Não foi possível gerar um novo token.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Controle Remoto
        </h3>
        <p className="text-xs text-muted-foreground">
          Permita que operadores e líderes controlem o setlist e telão pelo celular na mesma rede Wi-Fi.
        </p>
      </div>

      {/* Main Activation Card */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors",
                enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Smartphone className="size-4.5" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Habilitar Controle Remoto
              </h4>
              <p className="text-xs text-muted-foreground">
                Permite conexões pela interface web mobile e WebSocket com token seguro.
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => void setEnabled(checked)}
            disabled={loading}
            aria-label="Habilitar Controle Remoto"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Server Status Warning if stopped */}
      {!serverRunning && enabled && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>O servidor web local está parado. Inicie-o para permitir conexões remotas.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
            onClick={() => void startServer()}
          >
            Iniciar servidor
          </Button>
        </div>
      )}

      {/* When enabled: Connection Details */}
      {enabled && (
        <div className="flex flex-col gap-5 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Wifi className="size-4 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">Conexão na Rede Local</span>
            </div>
            <Badge variant="secondary" className="font-mono text-[11px]">
              Porta {port}
            </Badge>
          </div>

          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl border border-border bg-white p-3 shadow-xs">
                {token ? (
                  <QRCodeSVG
                    value={remoteUrl}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#09090b"
                    level="M"
                  />
                ) : (
                  <div className="flex size-40 items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                Escaneie com a câmera do celular
              </span>
            </div>

            {/* Inputs & Actions */}
            <div className="flex flex-col gap-3 min-w-0 justify-center">
              {/* URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Link de Acesso
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={remoteUrl}
                    className="font-mono text-xs bg-muted/40 h-8.5 select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8.5 shrink-0 gap-1.5 text-xs"
                    onClick={handleCopyUrl}
                  >
                    {copiedUrl ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    Copiar
                  </Button>
                </div>
              </div>

              {/* Token */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Token de Autenticação
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    readOnly
                    value={token}
                    className="font-mono text-xs bg-muted/40 h-8.5"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8.5 shrink-0 gap-1.5 text-xs"
                    onClick={handleCopyToken}
                  >
                    {copiedToken ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    Copiar
                  </Button>
                </div>
              </div>

              {/* Regenerate Token */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Se um celular desconhecido conectar, gere um novo token.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant={confirmRegenerate ? "destructive" : "ghost"}
                  className="h-8 shrink-0 text-xs gap-1.5"
                  onClick={handleRegenerate}
                  onMouseLeave={() => setConfirmRegenerate(false)}
                >
                  <RefreshCw className={cn("size-3.5", confirmRegenerate && "animate-spin")} />
                  {confirmRegenerate ? "Confirmar novo token?" : "Gerar novo token"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 border border-border/40">
            <p className="font-medium text-foreground">Como usar:</p>
            <p>1. Conecte o celular na mesma rede Wi-Fi do computador que está rodando o Open Presenter.</p>
            <p>2. Aponte a câmera para o QR Code acima ou abra o link no navegador do smartphone.</p>
            <p>3. Use a interface para navegar nos slides, limpar texto, alternar papel de parede ou tela preta.</p>
          </div>
        </div>
      )}
    </div>
  );
}
