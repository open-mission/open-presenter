import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { APP_VERSION } from "@/core/config/version";
import { isTauri } from "@/core/ipc/tauri";
import { openExternal } from "@/core/lib/openExternal";
import { ReleaseNotesPreview } from "@/features/updates/ReleaseNotesPreview";
import {
  CHANGELOG_URL,
  RELEASES_URL,
  getReleaseNotes,
} from "@/features/updates/releases";
import { useUpdatesStore } from "@/features/updates/store";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function UpdatesTab() {
  const status = useUpdatesStore((s) => s.status);
  const update = useUpdatesStore((s) => s.update);
  const error = useUpdatesStore((s) => s.error);
  const progress = useUpdatesStore((s) => s.progress);
  const autoCheck = useUpdatesStore((s) => s.autoCheck);
  const checkNow = useUpdatesStore((s) => s.checkNow);
  const install = useUpdatesStore((s) => s.install);
  const setAutoCheck = useUpdatesStore((s) => s.setAutoCheck);
  const openWhatsNew = useUpdatesStore((s) => s.openWhatsNew);
  const release = getReleaseNotes(APP_VERSION);
  const isBusy = status === "downloading" || status === "installing";
  const percent = progress?.percent ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Atualizações
        </h3>
        <p className="text-xs text-muted-foreground">
          Mantenha o Open Presenter atualizado com as melhorias e correções mais
          recentes.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <RefreshCw className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Versão instalada
              </h4>
              <p className="text-xs text-muted-foreground">
                Canal estável · GitHub Releases
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            v{APP_VERSION}
          </Badge>
        </div>

        <div className="border-t border-border/60 pt-3">
          {status === "unsupported" && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              A verificação e a instalação automática estão disponíveis apenas no
              app desktop. Nesta prévia web, use o GitHub para baixar a versão
              mais recente.
            </p>
          )}

          {status === "checking" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin text-primary" />
              Verificando se há uma nova versão…
            </p>
          )}

          {status === "up-to-date" && (
            <p className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Você está usando a versão mais recente.
            </p>
          )}

          {status === "installed" && (
            <p className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              Atualização instalada. Feche e abra o Open Presenter para usar a
              nova versão.
            </p>
          )}

          {status === "error" && (
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {error ?? "Não foi possível verificar as atualizações."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void checkNow({ openDialog: false })}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {status === "available" && update && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Versão {update.version} disponível
                  </p>
                  {formatDate(update.date) && (
                    <p className="text-[11px] text-muted-foreground">
                      Publicada em {formatDate(update.date)}
                    </p>
                  )}
                </div>
                <Badge className="bg-emerald-600 text-white">Nova</Badge>
              </div>
              {update.body && (
                <ReleaseNotesPreview
                  body={update.body}
                  className="max-h-40 rounded-lg border border-border/70 bg-muted/20 p-3"
                />
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void install()}
                >
                  <Download className="size-3.5" />
                  Baixar e instalar
                </Button>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Assinatura verificada
                </span>
              </div>
            </div>
          )}

          {isBusy && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-foreground">
                  <LoaderCircle className="size-3.5 animate-spin text-primary" />
                  {status === "installing"
                    ? "Instalando atualização…"
                    : "Baixando atualização…"}
                </span>
                {percent !== null && (
                  <span className="font-mono text-muted-foreground">
                    {percent}%
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${percent ?? 35}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                O app será reiniciado automaticamente ao terminar.
              </p>
            </div>
          )}

          {!isBusy && status !== "available" && status !== "installed" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={status === "checking" || !isTauri()}
                onClick={() => void checkNow({ openDialog: false })}
              >
                <RefreshCw className="size-3.5" />
                Verificar atualizações
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => void openExternal(RELEASES_URL)}
              >
                <Globe className="size-3.5" />
                Ver releases
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card/60 p-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Verificar automaticamente
          </h4>
          <p className="text-xs text-muted-foreground">
            Ao abrir o app, procure por novas versões e avise quando houver uma
            atualização disponível.
          </p>
        </div>
        <Switch
          checked={autoCheck}
          disabled={!isTauri()}
          onCheckedChange={setAutoCheck}
          aria-label="Verificar atualizações automaticamente"
        />
      </div>

      {release && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card/60 p-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Novidades da versão {release.version}
            </h4>
            <p className="text-xs text-muted-foreground">
              {release.title} — veja o que mudou nesta atualização.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openWhatsNew}
          >
            <Sparkles className="size-3.5" />
            Ver novidades
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => void openExternal(CHANGELOG_URL)}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
      >
        <ExternalLink className="size-3.5" />
        Changelog técnico completo no GitHub
      </button>
    </div>
  );
}
