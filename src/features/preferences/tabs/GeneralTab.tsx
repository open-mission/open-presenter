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
  { key: "C", action: "Limpar texto mantendo fundo de vídeo", scope: "Apresentação" },
  { key: "Espaço / →", action: "Avançar para o próximo slide da letra", scope: "Navegação" },
  { key: "Shift+Espaço / ←", action: "Retornar ao slide anterior", scope: "Navegação" },
  { key: "Esc", action: "Fechar modais e caixas de diálogo", scope: "Interface" },
];

export function GeneralTab() {
  const host = useOutputManagerStore((s) => s.host);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Geral & Sistema
        </h3>
        <p className="text-sm text-muted-foreground">
          Informações do aplicativo, atalhos rápidos de teclado e status dos serviços locais.
        </p>
      </div>

      {/* App Info Card */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
              OP
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground">
                Open Presenter
              </h4>
              <p className="text-xs text-muted-foreground">
                Software desktop open-source para igrejas e eventos
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            v0.1.0
          </Badge>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 border-t border-border/60 pt-3 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="size-3.5 text-primary" />
            <span>
              Servidor Web: <code className="text-foreground">{host}:5050</code>
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="size-3.5 text-emerald-500" />
            <span>Banco SQLite: Conectado</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Motor: Tauri v2 + React 19</span>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Keyboard className="size-4 text-muted-foreground" />
          <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Atalhos do Operador
          </h4>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="divide-y divide-border/60">
            {SHORTCUTS.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <kbd className="inline-flex h-6 min-w-8 items-center justify-center rounded border border-border bg-muted/60 px-1.5 font-mono font-semibold text-[11px] text-foreground shadow-2xs">
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
