import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BibleVersion } from "@/core/types";
import {
  useBibleStore,
  type BibleImportProgress,
  type BibleImportResult,
} from "./store";
import { pickBibleFiles } from "./bibleFilePicker";
import { formatBibleVersionLabel, formatBibleVersionAbbrev } from "./bibleUtils";

export function ManageBibleVersionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = useBibleStore((s) => s.versions);
  const activeVersionId = useBibleStore((s) => s.activeVersionId);
  const importBibleFiles = useBibleStore((s) => s.importBibleFiles);
  const deleteBibleVersion = useBibleStore((s) => s.deleteBibleVersion);

  const [progress, setProgress] = useState<BibleImportProgress | null>(null);
  const [summary, setSummary] = useState<BibleImportResult | null>(null);

  async function handleAdd() {
    const paths = await pickBibleFiles(true);
    if (paths.length === 0) return;
    setSummary(null);
    const result = await importBibleFiles(paths, {
      silent: true,
      onProgress: setProgress,
    });
    setProgress(null);
    setSummary(result);
    if (result.errors.length === 0) {
      toast.success(`${result.imported.length} versão(ões) importada(s).`);
    } else {
      toast.error(
        `${result.imported.length} importada(s), ${result.errors.length} com erro.`,
      );
    }
  }

  async function handleDelete(version: BibleVersion) {
    if (!confirm(`Deseja realmente remover a versão "${version.name}"?`)) return;
    await deleteBibleVersion(version.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerenciar versões da Bíblia</DialogTitle>
          <DialogDescription>
            Versões com o mesmo id substituem o arquivo existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {versions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma versão instalada.
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {formatBibleVersionLabel(version)}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {formatBibleVersionAbbrev(version)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {version.id === activeVersionId && <Badge>Ativa</Badge>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(version)}
                      title={`Remover ${version.name}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {progress && (
            <p className="text-xs text-muted-foreground">
              Importando {progress.done} de {progress.total}… {progress.file}
            </p>
          )}

          {summary && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
              <p className="font-semibold">
                {summary.imported.length} importada(s), {summary.errors.length}{" "}
                com erro.
              </p>
              {summary.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-destructive">
                  {summary.errors.map((error) => (
                    <li key={error.file}>
                      {error.file}: {error.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => void handleAdd()}
            disabled={progress !== null}
          >
            <Plus className="mr-1 size-4" />
            Adicionar versões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}