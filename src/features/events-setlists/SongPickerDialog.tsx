import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSongsStore } from "@/features/songs/store";
import { useSetlistStore } from "./store";

interface SongPickerDialogProps {
  partId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function SongPickerDialog({
  partId,
  open,
  onOpenChange,
}: SongPickerDialogProps) {
  const songs = useSongsStore((s) => s.songs);
  const loading = useSongsStore((s) => s.loading);
  const error = useSongsStore((s) => s.error);
  const load = useSongsStore((s) => s.load);
  const addSong = useSetlistStore((s) => s.addSong);

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open && useSongsStore.getState().songs.length === 0) {
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const needle = query.trim().toLowerCase();
  const filtered =
    needle === ""
      ? songs
      : songs.filter(
          (song) =>
            song.title.toLowerCase().includes(needle) ||
            song.artist.toLowerCase().includes(needle),
        );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Adicionar música</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar por título ou artista"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ScrollArea className="h-64">
          <div className="flex flex-col gap-1 pr-2">
            {loading && songs.length === 0 && (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            )}
            {!loading && error !== null && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!loading && error === null && songs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma música no catálogo.
              </p>
            )}
            {!loading && error === null && songs.length > 0 && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma música encontrada.
              </p>
            )}
            {filtered.map((song) => (
              <Button
                key={song.id}
                variant="secondary"
                className="justify-start"
                onClick={() => {
                  addSong(partId, song.id);
                  onOpenChange(false);
                }}
              >
                <span className="min-w-0 truncate">
                  {song.title}
                  {song.artist !== "" && (
                    <span className="text-muted-foreground"> · {song.artist}</span>
                  )}
                </span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
