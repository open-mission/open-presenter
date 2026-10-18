import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSongsStore } from "./store";

export function OnlineLyricsDialog() {
  const onlineOpen = useSongsStore((s) => s.onlineOpen);
  const onlineQuery = useSongsStore((s) => s.onlineQuery);
  const onlineResults = useSongsStore((s) => s.onlineResults);
  const onlineLoading = useSongsStore((s) => s.onlineLoading);
  const onlineError = useSongsStore((s) => s.onlineError);
  const closeOnlineSearch = useSongsStore((s) => s.closeOnlineSearch);
  const setOnlineQuery = useSongsStore((s) => s.setOnlineQuery);
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
          className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>Buscar letra na internet</DialogTitle>
          </DialogHeader>
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
              className="shrink-0"
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
                Digite o nome da música ou do artista para buscar a letra.
              </p>
            )}
          {!onlineLoading && onlineError === null && onlineResults.length > 0 && (
            <ScrollArea className="max-h-[50vh] w-full min-w-0">
              <div className="flex flex-col gap-1.5 pr-2.5 w-full min-w-0">
                {onlineResults.map((hit, index) => (
                  <Button
                    key={`${hit.trackName}-${hit.artistName}-${index}`}
                    variant="secondary"
                    className="w-full justify-start text-left h-auto py-2.5 px-3 min-w-0 overflow-hidden"
                    onClick={() => importOnlineHit(hit)}
                  >
                    <div className="flex flex-col min-w-0 w-full text-left truncate">
                      <span className="truncate font-medium text-foreground text-sm">
                        {hit.trackName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {hit.artistName}
                        {hit.albumName ? ` · ${hit.albumName}` : ""}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
