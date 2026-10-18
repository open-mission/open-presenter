import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import { getRemoteClients } from "@/core/ipc/commands";
import type { ConnectedClient } from "@/core/types";
import { deviceLabel } from "./device";

const POLL_MS = 3000;

function sinceLabel(connectedAt: number): string {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - connectedAt);
  if (elapsed < 60) return "conectado agora";
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function RemoteDevices() {
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function load(): Promise<void> {
      try {
        const list = await getRemoteClients();
        if (!disposed) setClients(list);
      } catch {
        if (!disposed) setClients([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      setClients(await getRemoteClients());
    } catch {
      setClients([]);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Wifi className="size-4.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                Dispositivos conectados
              </h4>
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px]">
                {clients.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Celulares e tablets com o controle remoto aberto.
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
            className={cn("size-3.5", refreshing && "animate-spin text-primary")}
          />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Carregando dispositivos…
        </div>
      ) : clients.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <Smartphone className="size-4 shrink-0 text-muted-foreground" />
          <span>
            Nenhum dispositivo conectado. Escaneie o QR Code acima para abrir o
            controle remoto no celular.
          </span>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/40">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Smartphone className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {deviceLabel(client.userAgent)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{client.ip}</span> ·{" "}
                    {sinceLabel(client.connectedAt)}
                  </p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Conectado
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
