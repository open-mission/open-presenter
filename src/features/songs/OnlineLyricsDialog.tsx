import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSongsStore } from "./store";

const PROVIDER_FILTERS = [
  { id: "all", label: "Todos os provedores" },
  { id: "holyrics", label: "Holyrics" },
  { id: "vagalume", label: "Vagalume" },
  { id: "lrclib", label: "LRCLIB" },
];

function ProviderBadge({ provider }: { provider?: string | null }) {
  if (provider === "holyrics") {
    return (
      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        Holyrics
      </span>
    );
  }
  if (provider === "vagalume") {
    return (
      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Vagalume
      </span>
    );
  }
  if (provider === "lrclib") {
    return (
      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        LRCLIB
      </span>
    );
  }
  return null;
}

export function OnlineLyricsDialog() {
  const onlineOpen = useSongsStore((s) => s.onlineOpen);
  const onlineQuery = useSongsStore((s) => s.onlineQuery);
  const onlineProvider = useSongsStore((s) => s.onlineProvider);
  const onlineResults = useSongsStore((s) => s.onlineResults);
  const onlineLoading = useSongsStore((s) => s.onlineLoading);
  const onlineError = useSongsStore((s) => s.onlineError);
  const closeOnlineSearch = useSongsStore((s) => s.closeOnlineSearch);
  const setOnlineQuery = useSongsStore((s) => s.setOnlineQuery);
  const setOnlineProvider = useSongsStore((s) => s.setOnlineProvider);
  const searchOnline = useSongsStore((s) => s.searchOnline);
  const importOnlineHit = useSongsStore((s) => s.importOnlineHit);

  return (
    <Dialog
      open={onlineOpen}
      onOpenChange={(open) => {
        if (!open) closeOnlineSearch();
      }}
    >
      {onlineOpen && (
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-xl max-h-[90vh] flex flex-col min-h-0 overflow-hidden gap-3"
        >
          <DialogHeader className="pb-1">
            <DialogTitle>Buscar letra na internet</DialogTitle>
          </DialogHeader>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_FILTERS.map((filter) => {
              const active = (onlineProvider ?? "all") === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setOnlineProvider(filter.id);
                    if (onlineQuery.trim() !== "") {
                      setTimeout(() => void searchOnline(), 0);
                    }
                  }}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <form
            className="flex w-full min-w-0 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              searchOnline();
            }}
          >
            <Input
              className="min-w-0 flex-1"
              placeholder="Nome da música ou artista"
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
            />
            <Button
              type="submit"
              disabled={onlineLoading || onlineQuery.trim() === ""}
              className="shrink-0 cursor-pointer"
            >
              {onlineLoading ? "Buscando…" : "Buscar"}
            </Button>
          </form>

          {onlineError !== null && (
            <p className="text-sm text-destructive">{onlineError}</p>
          )}

          {!onlineLoading &&
            onlineError === null &&
            onlineResults.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Digite o nome da música ou artista e clique em Buscar para consultar os provedores configurados.
              </p>
            )}

          {!onlineLoading && onlineError === null && onlineResults.length > 0 && (
            <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto pr-1.5 space-y-1.5 [scrollbar-gutter:stable]">
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                {onlineResults.map((hit, index) => (
                  <Button
                    key={`${hit.trackName}-${hit.artistName}-${hit.provider}-${index}`}
                    variant="secondary"
                    className="w-full justify-start text-left h-auto py-2.5 px-3 min-w-0 overflow-hidden cursor-pointer hover:bg-accent/60"
                    onClick={() => importOnlineHit(hit)}
                  >
                    <div className="flex items-center justify-between gap-3 w-full min-w-0">
                      <div className="flex flex-col min-w-0 truncate text-left">
                        <span className="truncate font-medium text-foreground text-sm">
                          {hit.trackName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {hit.artistName}
                          {hit.albumName ? ` · ${hit.albumName}` : ""}
                        </span>
                      </div>
                      <ProviderBadge provider={hit.provider} />
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Resultados de acervos públicos e parceiros.</span>
            <span>Configurações &gt; Músicas para gerenciar provedores</span>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
