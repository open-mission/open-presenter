import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSongsStore } from "./store";

export function ImportReportDialog() {
  const importReport = useSongsStore((s) => s.importReport);
  const closeImportReport = useSongsStore((s) => s.closeImportReport);

  return (
    <Dialog
      open={importReport !== null}
      onOpenChange={(open) => {
        if (!open) closeImportReport();
      }}
    >
      {importReport && (
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Relatório de importação</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto text-sm">
            <section className="flex flex-col gap-1">
              <h3 className="font-medium">
                {importReport.imported.length === 0
                  ? "Nenhuma música importada."
                  : `${importReport.imported.length} ${
                      importReport.imported.length === 1
                        ? "música importada"
                        : "músicas importadas"
                    }`}
              </h3>
              {importReport.imported.length > 0 && (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {importReport.imported.map((title, index) => (
                    <li key={index}>{title}</li>
                  ))}
                </ul>
              )}
            </section>
            <section className="flex flex-col gap-1">
              <h3 className="font-medium">Puladas</h3>
              {importReport.skipped.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma música pulada.</p>
              ) : (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {importReport.skipped.map((skip, index) => (
                    <li key={index}>
                      {skip.title} — {skip.reason}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {importReport.errors.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="font-medium">Erros</h3>
                <ul className="list-disc pl-5 text-destructive">
                  {importReport.errors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImportReport}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
