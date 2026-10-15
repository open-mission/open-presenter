import { Music, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePresentationStore } from "../presentation/store";
import { searchSongs, useSongsStore } from "./store";

export function SongsPanel() {
  const songs = useSongsStore((s) => s.songs);
  const query = useSongsStore((s) => s.query);
  const setQuery = useSongsStore((s) => s.setQuery);
  const setPreview = usePresentationStore((s) => s.setPreview);

  const results = searchSongs(songs, query);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Músicas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2">
          <Search size={14} className="text-zinc-400" />
          <input
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
            placeholder="Buscar por título, artista ou trecho…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {results.map((song) => (
          <Button
            key={song.id}
            variant="secondary"
            className="justify-start"
            onClick={() =>
              setPreview({
                id: song.id,
                kind: "lyric",
                title: song.title,
                lines: song.lyrics,
              })
            }
          >
            <Music size={14} />
            <span className="truncate">
              {song.title}
              <span className="text-zinc-400"> · {song.artist}</span>
            </span>
          </Button>
        ))}
        {results.length === 0 && (
          <p className="text-sm text-zinc-400">Nenhuma música encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
}
