import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CloudDownload,
  Globe,
  Loader2,
  Music,
  Play,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/lib/utils";
import { computeSlideGroups, type SlideGroup } from "@/core/lib/lyrics";
import { songGroupColor } from "@/core/lib/songGroups";
import type {
  LiveSlide,
  RemoteSlide,
  Song,
  SongGroupConfig,
  SongSummary,
} from "@/core/types";
import { DEFAULT_SONG_GROUPS } from "@/features/songs/songGroupsStore";

interface OnlineHit {
  trackName: string;
  artistName: string;
  albumName?: string | null;
}

interface RemoteSongsTabProps {
  token: string;
  live: LiveSlide | null;
  onPost: (path: string, body?: unknown) => Promise<boolean>;
  groups?: SongGroupConfig[];
}

export function RemoteSongsTab({
  token,
  live,
  onPost,
  groups = DEFAULT_SONG_GROUPS,
}: RemoteSongsTabProps) {
  const [query, setQuery] = useState("");
  const [localSongs, setLocalSongs] = useState<SongSummary[]>([]);
  const [onlineHits, setOnlineHits] = useState<OnlineHit[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [savingTrack, setSavingTrack] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongSummary | null>(null);
  const [slides, setSlides] = useState<RemoteSlide[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca na biblioteca local com debounce
  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();
    setLoadingLocal(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const url = trimmed
            ? `/api/v1/songs?q=${encodeURIComponent(trimmed)}`
            : "/api/v1/songs";
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Falha ao carregar músicas");
          const data = (await res.json()) as SongSummary[];
          if (!cancelled) {
            setLocalSongs(data);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        } finally {
          if (!cancelled) setLoadingLocal(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, token]);

  // Carrega slides quando uma música é selecionada
  useEffect(() => {
    if (!selectedSong) {
      setSlides([]);
      return;
    }
    let cancelled = false;
    setLoadingSlides(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/v1/songs/${selectedSong.id}/slides`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Falha ao carregar slides da música");
        const data = (await res.json()) as RemoteSlide[];
        if (!cancelled) {
          setSlides(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoadingSlides(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSong, token]);

  const searchOnline = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoadingOnline(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/lyrics/search?q=${encodeURIComponent(trimmed)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao buscar no LRCLIB");
      }
      const data = (await res.json()) as OnlineHit[];
      setOnlineHits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOnline(false);
    }
  }, [query, token]);

  const saveOnlineTrack = useCallback(
    async (hit: OnlineHit) => {
      const key = `${hit.trackName}#${hit.artistName}`;
      setSavingTrack(key);
      setError(null);
      try {
        const res = await fetch("/api/v1/lyrics/save", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackName: hit.trackName,
            artistName: hit.artistName,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Falha ao salvar letra da internet");
        }
        const saved = (await res.json()) as Song;
        const summary: SongSummary = {
          id: saved.id,
          title: saved.title,
          artist: saved.artist,
          album: saved.album,
          composer: saved.composer,
          songKey: saved.songKey,
          bpm: saved.bpm,
        };
        // Abre imediatamente a música salva
        setSelectedSong(summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSavingTrack(null);
      }
    },
    [token],
  );

  const presentSlide = useCallback(
    async (index: number) => {
      if (!selectedSong) return;
      await onPost("present-song", {
        songId: selectedSong.id,
        index,
      });
    },
    [selectedSong, onPost],
  );

  const groupBySlideIndex = useMemo(() => {
    const map = new Map<number, SlideGroup>();
    for (const group of computeSlideGroups(slides)) {
      for (const index of group.indices) map.set(index, group);
    }
    return map;
  }, [slides]);

  // Se uma música estiver selecionada, renderiza a visualização dos slides da música
  if (selectedSong) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSong(null)}
            className="gap-1.5 cursor-pointer text-xs"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>

          <div className="min-w-0 flex-1 text-right">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {selectedSong.title}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {selectedSong.artist || "Artista desconhecido"}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {loadingSlides ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : slides.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nenhum slide disponível para esta música.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {slides.map((slide) => {
              const slideId = `${selectedSong.id}#${slide.index}`;
              const isLive = live?.content.id === slideId;
              const group = groupBySlideIndex.get(slide.index);
              const type = group?.sectionType ?? slide.sectionType;
              const label = slide.label ?? group?.label ?? null;
              const color = songGroupColor(groups, type, label);
              return (
                <button
                  key={slide.index}
                  type="button"
                  onClick={() => presentSlide(slide.index)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer",
                    isLive
                      ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                  )}
                  style={
                    isLive || !color
                      ? undefined
                      : { borderColor: `${color}55` }
                  }
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        #{slide.index + 1}
                      </span>
                      {label && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] font-semibold"
                          style={
                            color
                              ? {
                                  borderColor: `${color}66`,
                                  backgroundColor: `${color}15`,
                                  color,
                                }
                              : undefined
                          }
                        >
                          {label}
                        </Badge>
                      )}
                    </div>
                    {isLive ? (
                      <Badge className="bg-emerald-600 px-1.5 py-0 text-[10px] text-white hover:bg-emerald-600">
                        Ao vivo
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Play className="size-3" />
                        Apresentar
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 text-xs font-medium text-foreground">
                    {slide.content.lines.map((line, lIdx) => (
                      <span key={lIdx} className="line-clamp-1">
                        {line}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de Busca */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, artista ou letra…"
            className="pl-9 pr-3 text-xs"
          />
        </div>

        {query.trim().length > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={searchOnline}
            disabled={loadingOnline}
            className="gap-2 cursor-pointer text-xs"
          >
            {loadingOnline ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Globe className="size-3.5" />
            )}
            Buscar "{query.trim()}" na internet (LRCLIB)
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Resultados da Internet (quando houver) */}
      {onlineHits.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Globe className="size-3.5" />
            <span>Resultados da Internet (LRCLIB)</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {onlineHits.map((hit, idx) => {
              const key = `${hit.trackName}#${hit.artistName}`;
              const isSaving = savingTrack === key;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {hit.trackName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {hit.artistName}
                      {hit.albumName ? ` · ${hit.albumName}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isSaving}
                    onClick={() => saveOnlineTrack(hit)}
                    className="shrink-0 gap-1.5 cursor-pointer text-xs"
                  >
                    {isSaving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CloudDownload className="size-3" />
                    )}
                    Salvar e Abrir
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resultados da Biblioteca Local */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-foreground">
            Biblioteca Local
          </span>
          <span className="text-[11px] text-muted-foreground">
            {localSongs.length}{" "}
            {localSongs.length === 1 ? "música" : "músicas"}
          </span>
        </div>

        {loadingLocal ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : localSongs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhuma música encontrada na biblioteca.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {localSongs.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => setSelectedSong(song)}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Music className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {song.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {song.artist || "Artista desconhecido"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Ver slides
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
