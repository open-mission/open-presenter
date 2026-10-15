import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImportReportDialog } from "./ImportReportDialog";
import { SongEditorDialog } from "./SongEditorDialog";
import { useSongsStore } from "./store";

export function SongsPanel() {
  const songs = useSongsStore((s) => s.songs);
  const query = useSongsStore((s) => s.query);
  const loading = useSongsStore((s) => s.loading);
  const error = useSongsStore((s) => s.error);
  const setQuery = useSongsStore((s) => s.setQuery);
  const load = useSongsStore((s) => s.load);
  const startNewSong = useSongsStore((s) => s.startNewSong);
  const editSong = useSongsStore((s) => s.editSong);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Músicas</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={startNewSong}>
                Nova música
              </Button>
              <Button size="sm" variant="outline" disabled>
                Buscar na internet
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Input
            placeholder="Buscar por título, artista ou trecho"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && songs.length === 0 && (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
          {!loading && error !== null && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && error === null && songs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma música encontrada.
            </p>
          )}
          {songs.map((song) => (
            <Button
              key={song.id}
              variant="secondary"
              className="justify-start"
              onClick={() => editSong(song.id)}
            >
              <span className="min-w-0 truncate">
                {song.title}
                {song.artist !== "" && (
                  <span className="text-muted-foreground"> · {song.artist}</span>
                )}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>
      <SongEditorDialog />
      <ImportReportDialog />
    </>
  );
}
