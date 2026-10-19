import { BookOpen, Check, Copy, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBibleStore } from "./store";
import { toast } from "sonner";

export function CompareModal() {
  const isComparing = useBibleStore((s) => s.isComparing);
  const compareTarget = useBibleStore((s) => s.compareTarget);
  const compareResults = useBibleStore((s) => s.compareResults);
  const closeCompare = useBibleStore((s) => s.closeCompare);
  const presentFromCompare = useBibleStore((s) => s.presentFromCompare);
  const activeVersionId = useBibleStore((s) => s.activeVersionId);

  if (!isComparing || !compareTarget) return null;

  function handleCopy(text: string, version: string) {
    void navigator.clipboard.writeText(
      `"${text}" - ${compareTarget?.bookName} ${compareTarget?.chapter}:${compareTarget?.verse} (${version})`,
    );
    toast.success("Versículo copiado!");
  }

  return (
    <Dialog open={isComparing} onOpenChange={(open) => !open && closeCompare()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                Comparar Versões · {compareTarget.bookName} {compareTarget.chapter}:{compareTarget.verse}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Compare o texto nas diferentes versões da Bíblia instaladas e selecione a melhor opção para projetar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {compareResults.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">
              Carregando versões para comparação...
            </p>
          ) : (
            compareResults.map((item) => {
              const isCurrentActive = item.versionId === activeVersionId;
              const hasVerse = Boolean(item.verse);

              return (
                <div
                  key={item.versionId}
                  className={`relative rounded-xl border p-4 transition-all ${
                    isCurrentActive
                      ? "border-primary/60 bg-primary/5 shadow-xs"
                      : "border-border/60 bg-muted/20 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {item.versionName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-mono">
                        {item.versionId}
                      </span>
                      {isCurrentActive && (
                        <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                          <Check className="size-3" /> Versão Selecionada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {hasVerse && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(item.verse!.text, item.versionName)}
                          title="Copiar texto"
                        >
                          <Copy className="size-3.5 mr-1" /> Copiar
                        </Button>
                      )}
                      {hasVerse && (
                        <Button
                          variant={isCurrentActive ? "default" : "secondary"}
                          size="sm"
                          className="h-7 text-xs font-semibold cursor-pointer"
                          onClick={() => {
                            void presentFromCompare(item);
                            closeCompare();
                          }}
                        >
                          <Radio className="size-3.5 mr-1 text-emerald-400" />
                          Projetar nesta versão
                        </Button>
                      )}
                    </div>
                  </div>

                  {hasVerse ? (
                    <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                      {item.verse!.text}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      Versículo não encontrado nesta versão.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border/60 pt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={closeCompare}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
