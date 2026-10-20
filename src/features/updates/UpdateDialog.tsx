import { Download, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_VERSION } from "@/core/config/version";
import { ReleaseNotesPreview } from "./ReleaseNotesPreview";
import { useUpdatesStore } from "./store";

export function UpdateDialog() {
  const update = useUpdatesStore((s) => s.update);
  const isOpen = useUpdatesStore((s) => s.dialogOpen);
  const status = useUpdatesStore((s) => s.status);
  const error = useUpdatesStore((s) => s.error);
  const progress = useUpdatesStore((s) => s.progress);
  const closeDialog = useUpdatesStore((s) => s.closeDialog);
  const install = useUpdatesStore((s) => s.install);

  if (!update) return null;

  const isBusy = status === "downloading" || status === "installing";
  const isInstalled = status === "installed";
  const percent = progress?.percent ?? null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isBusy) closeDialog();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Download className="size-4" />
            </div>
            <Badge variant="secondary" className="font-mono text-[11px]">
              {APP_VERSION} → {update.version}
            </Badge>
          </div>
          <DialogTitle>Uma nova versão está disponível</DialogTitle>
          <DialogDescription>
            Atualize para receber as melhorias e correções mais recentes. O
            Open Presenter baixa e instala tudo automaticamente.
          </DialogDescription>
        </DialogHeader>

        {update.body && (
          <ReleaseNotesPreview
            body={update.body}
            className="max-h-56 rounded-xl border border-border/70 bg-muted/20 p-4"
          />
        )}

        {isBusy && (
          <div className="space-y-2 rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <LoaderCircle className="size-3.5 animate-spin text-primary" />
                {status === "installing"
                  ? "Instalando atualização…"
                  : "Baixando atualização…"}
              </span>
              {percent !== null && (
                <span className="font-mono text-muted-foreground">{percent}%</span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${percent ?? 35}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              O app vai reiniciar sozinho quando terminar. Não feche o Open
              Presenter durante a instalação.
            </p>
          </div>
        )}

        {isInstalled && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            Atualização instalada. Feche e abra o Open Presenter para usar a nova
            versão.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          Atualização verificada e assinada digitalmente.
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={closeDialog}
          >
            Depois
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={isBusy || isInstalled}
            onClick={() => void install()}
          >
            {isBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {isInstalled ? "Instalada" : isBusy ? "Atualizando…" : "Atualizar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
