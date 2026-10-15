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
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Buscar letra na internet</DialogTitle>
          </DialogHeader>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              searchOnline();
            }}
          >
            <Input
              placeholder="Nome da música ou artista"
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
            />
            <Button
              type="submit"
              disabled={onlineLoading || onlineQuery.trim() === ""}
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
            <ScrollArea className="max-h-[50vh]">
              <div className="flex flex-col gap-1 pr-2">
                {onlineResults.map((hit, index) => (
                  <Button
                    key={`${hit.trackName}-${hit.artistName}-${index}`}
                    variant="secondary"
                    className="justify-start"
                    onClick={() => importOnlineHit(hit)}
                  >
                    <span className="min-w-0 truncate">
                      {hit.trackName}
                      <span className="text-muted-foreground">
                        {" · "}
                        {hit.artistName}
                      </span>
                      {hit.albumName !== null && (
                        <span className="text-muted-foreground">
                          {" · "}
                          {hit.albumName}
                        </span>
                      )}
                    </span>
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
