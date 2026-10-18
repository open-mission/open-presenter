import { Database, Globe, Keyboard, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOutputManagerStore } from "@/features/output-manager/store";

interface ShortcutItem {
  key: string;
  action: string;
  scope: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { key: "⌘ ,", action: "Abrir configurações e preferências", scope: "Geral" },
  { key: "B", action: "Blackout (escurecer projeção ao vivo)", scope: "Apresentação" },
  { key: "C", action: "Limpar texto mantendo plano de fundo", scope: "Apresentação" },
  { key: "Espaço / →", action: "Avançar para o próximo slide", scope: "Navegação" },
  { key: "Shift+Espaço / ←", action: "Retornar ao slide anterior", scope: "Navegação" },
  { key: "Enter", action: "Projetar slide selecionado", scope: "Navegação" },
  { key: "Esc", action: "Cancelar apresentação ativa / fechar modais", scope: "Geral" },
];

export function GeneralTab() {
  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Geral & Sistema
        </h3>
        <p className="text-xs text-muted-foreground">
          Status dos serviços locais e atalhos rápidos do operador.
        </p>
      </div>

      {/* App & Services Info */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-xs">
              OP
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground">
                Open Presenter
              </h4>
              <p className="text-xs text-muted-foreground">
                Software de apresentação multimídia e projeção
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            v0.1.0
          </Badge>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Globe className="size-3.5 text-primary" />
            <span>Servidor: <code className="font-mono text-foreground font-semibold">{host}:{port}</code></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="size-3.5 text-emerald-500" />
            <span>SQLite: <span className="text-foreground font-medium">Conectado</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Motor: <span className="text-foreground font-medium">Tauri v2 + React 19</span></span>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Keyboard className="size-4 text-muted-foreground" />
          <h4 className="font-semibold text-xs text-foreground">
            Atalhos do Operador
          </h4>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card/60">
          <div className="divide-y divide-border/60">
            {SHORTCUTS.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-4 py-2 text-xs transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <kbd className="inline-flex h-5 min-w-7 items-center justify-center rounded border border-border bg-muted/80 px-1.5 font-mono font-semibold text-[11px] text-foreground shadow-2xs">
                    {item.key}
                  </kbd>
                  <span className="font-medium text-foreground">
                    {item.action}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="font-normal text-[10px] text-muted-foreground"
                >
                  {item.scope}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
