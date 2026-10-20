import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Disc,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Globe,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Minus,
  Music,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSong } from "@/core/ipc/commands";
import { SECTION_COLOR, SECTION_LABEL } from "@/core/config/lyrics";
import {
  buildSongSlides,
  cleanCommentText,
  isChordLine,
  isCommentLine,
} from "@/core/lib/lyrics";
import type { SlideTheme, Song, SongSummary } from "@/core/types";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { isPublicTheme, previewTheme } from "@/features/slide-themes/pages";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { useSongsStore } from "./store";
import { useSetlistStore } from "@/features/events-setlists/store";

export function SongsPage() {
  const songs = useSongsStore((s) => s.songs);
  const query = useSongsStore((s) => s.query);
  const loading = useSongsStore((s) => s.loading);
  const setQuery = useSongsStore((s) => s.setQuery);
  const loadSongs = useSongsStore((s) => s.load);
  const startNewSong = useSongsStore((s) => s.startNewSong);
  const editSong = useSongsStore((s) => s.editSong);
  const deleteSong = useSongsStore((s) => s.deleteSong);
  const openOnlineSearch = useSongsStore((s) => s.openOnlineSearch);
  const startHolyricsImport = useSongsStore((s) => s.startHolyricsImport);

  // Setlist connection
  const activeEvent = useSetlistStore((s) => s.event);
  const addSongToSetlist = useSetlistStore((s) => s.addSong);
  const addPartToSetlist = useSetlistStore((s) => s.addPart);
  const saveSetlist = useSetlistStore((s) => s.save);

  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Visualização dos slides (grade vs lista, tema público e zoom)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [themePreviewActive, setThemePreviewActive] = useState(false);
  const [cardMinSize, setCardMinSize] = useState<number>(220);

  const handleZoomIn = () => {
    setCardMinSize((prev) => Math.min(prev + 40, 460));
  };

  const handleZoomOut = () => {
    setCardMinSize((prev) => Math.max(prev - 40, 160));
  };

  // Temas de slides
  const themes = useSlideThemesStore((s) => s.themes);
  const templateThemes = useMemo(
    () => themes.filter(isPublicTheme),
    [themes],
  );
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);

  const defaultTheme = useMemo(
    () => resolveTheme("public", "lyric"),
    [resolveTheme, themes],
  );

  const [selectedThemeGuid, setSelectedThemeGuid] = useState<string | null>(
    () => defaultTheme?.guid ?? (templateThemes[0]?.guid || null),
  );

  useEffect(() => {
    void ensureSeeded().then(() => void loadThemes());
  }, [ensureSeeded, loadThemes]);

  useEffect(() => {
    if (!selectedThemeGuid && defaultTheme) {
      setSelectedThemeGuid(defaultTheme.guid);
    }
  }, [defaultTheme, selectedThemeGuid]);

  const activeTheme: SlideTheme | null = useMemo(() => {
    if (!selectedThemeGuid) return defaultTheme ?? templateThemes[0] ?? null;
    return (
      themes.find((t) => t.guid === selectedThemeGuid) ??
      defaultTheme ??
      templateThemes[0] ??
      null
    );
  }, [selectedThemeGuid, themes, defaultTheme, templateThemes]);

  const activePreview = useMemo(
    () => (activeTheme ? previewTheme(activeTheme, "music") : null),
    [activeTheme],
  );

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSongs();
    }, 200);
    return () => clearTimeout(timer);
  }, [query, loadSongs]);

  // Load details when selectedSongId changes
  useEffect(() => {
    if (!selectedSongId) {
      setSelectedSong(null);
      return;
    }
    let cancelled = false;
    setLoadingSelected(true);
    void getSong(selectedSongId).then((song) => {
      if (!cancelled) {
        setSelectedSong(song);
        setLoadingSelected(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSongId]);

  // Auto-select first song if none selected
  useEffect(() => {
    if (songs.length > 0 && !selectedSongId) {
      setSelectedSongId(songs[0].id);
    }
  }, [songs, selectedSongId]);

  // Computed slides for selected song
  const slides = useMemo(() => {
    if (!selectedSong) return [];
    return buildSongSlides(selectedSong);
  }, [selectedSong]);

  function handleAddSongToActiveCulto(partId?: string) {
    if (!selectedSong) return;
    const summary: SongSummary = {
      id: selectedSong.id,
      title: selectedSong.title,
      artist: selectedSong.artist,
      songKey: selectedSong.songKey,
      bpm: selectedSong.bpm,
      composer: selectedSong.composer,
      album: selectedSong.album,
    };

    if (!activeEvent || activeEvent.parts.length === 0) {
      const newPartId = addPartToSetlist("Louvor");
      addSongToSetlist(newPartId, summary);
    } else {
      const targetPart = partId
        ? activeEvent.parts.find((p) => p.id === partId)
        : activeEvent.parts[0];
      const destId = targetPart ? targetPart.id : activeEvent.parts[0].id;
      addSongToSetlist(destId, summary);
    }
    void saveSetlist();
    toast.success(`"${selectedSong.title}" adicionada ao setlist do culto!`);
  }

  async function handleDeleteConfirmed() {
    if (!selectedSongId) return;
    const ok = await deleteSong(selectedSongId);
    if (ok) {
      toast.success("Música excluída com sucesso.");
      setSelectedSongId(null);
      setDeleteConfirmOpen(false);
    } else {
      toast.error("Erro ao excluir música.");
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Music className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Biblioteca de Músicas & Letras
              </h2>
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">
                {songs.length} músicas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Acesse todas as letras cadastradas, pesquise trechos e adicione novas composições
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={startHolyricsImport}
            title="Importar banco do Holyrics"
          >
            <Upload className="size-3.5" />
            <span className="hidden sm:inline">Importar Holyrics</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={openOnlineSearch}
            title="Buscar letra na internet (⌘⇧F)"
          >
            <Globe className="size-3.5" />
            <span className="hidden sm:inline">Buscar na Internet</span>
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={startNewSong}
            title="Criar nova música (⌘N)"
          >
            <Plus className="size-3.5" />
            <span>Nova Música</span>
          </Button>
        </div>
      </header>

      {/* Main 2-Column Split: Catalog on Left, Lyrics Viewer on Right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Search & Songs List */}
        <div className="flex w-80 flex-col border-r border-border bg-muted/15 sm:w-96 shrink-0 overflow-hidden">
          {/* Search Input Box */}
          <div className="p-3 border-b border-border bg-background/50">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, artista, autor ou trecho…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs bg-background"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Songs List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {loading && songs.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Carregando repertório…
                </div>
              )}

              {!loading && songs.length === 0 && (
                <div className="py-12 px-4 text-center">
                  <FileText className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-medium text-foreground">Nenhuma música encontrada</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {query ? "Tente buscar com outros termos." : "Adicione novas músicas usando o botão acima."}
                  </p>
                </div>
              )}

              {songs.map((song) => {
                const isSelected = song.id === selectedSongId;
                return (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => setSelectedSongId(song.id)}
                    className={`group relative flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                        : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/40 text-foreground"
                    }`}
                  >
                    {/* Indicador lateral ativo */}
                    {isSelected && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
                    )}

                    {/* Linha Superior: Título e Badges (Tom e BPM) */}
                    <div className="flex w-full items-start justify-between gap-1.5 pl-1">
                      <span
                        className={`font-semibold text-xs leading-snug line-clamp-1 ${
                          isSelected
                            ? "text-primary"
                            : "text-foreground group-hover:text-primary transition-colors"
                        }`}
                      >
                        {song.title}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {song.songKey && (
                          <Badge
                            variant="outline"
                            className="h-4.5 px-1.5 text-[10px] font-mono font-bold border-primary/40 text-primary bg-primary/5 gap-0.5"
                            title={`Tom: ${song.songKey}`}
                          >
                            <KeyRound className="size-2.5 opacity-70" />
                            {song.songKey}
                          </Badge>
                        )}
                        {song.bpm && (
                          <Badge
                            variant="secondary"
                            className="h-4.5 px-1.5 text-[10px] font-mono text-muted-foreground bg-muted/70 gap-0.5"
                            title={`Andamento: ${song.bpm} BPM`}
                          >
                            <Activity className="size-2.5 opacity-70" />
                            {song.bpm}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Linha do Artista */}
                    <div className="flex w-full items-center gap-1.5 pl-1 text-[11px] text-muted-foreground">
                      <User className="size-3 shrink-0 opacity-70" />
                      <span className="truncate">{song.artist || "Artista não informado"}</span>
                    </div>

                    {/* Linha de Metadados: Compositor / Álbum */}
                    {(song.composer || song.album) && (
                      <div className="flex w-full items-center gap-2 pl-1 pt-1 text-[10px] text-muted-foreground/80 border-t border-border/40">
                        {song.composer && (
                          <span className="truncate" title={`Compositor: ${song.composer}`}>
                            <span className="text-muted-foreground/50">Comp:</span> {song.composer}
                          </span>
                        )}
                        {song.composer && song.album && (
                          <span className="text-muted-foreground/40">•</span>
                        )}
                        {song.album && (
                          <span className="truncate flex items-center gap-1" title={`Álbum: ${song.album}`}>
                            <Disc className="size-2.5 opacity-60 shrink-0" />
                            <span className="truncate">{song.album}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Lyrics Preview & Actions */}
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          {selectedSong ? (
            <div className="flex h-full flex-col overflow-hidden">
              {/* Song Detail Header */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border p-4 bg-muted/10">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {selectedSong.title}
                    </h3>
                    {selectedSong.songKey && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-mono font-bold border-primary/40 text-primary bg-primary/5 gap-1"
                      >
                        <KeyRound className="size-3" />
                        Tom: {selectedSong.songKey}
                      </Badge>
                    )}
                    {selectedSong.bpm && (
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px] font-mono text-muted-foreground gap-1"
                      >
                        <Activity className="size-3" />
                        {selectedSong.bpm} BPM
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground/80">
                      {selectedSong.artist || "Artista desconhecido"}
                    </span>
                    {selectedSong.composer && (
                      <>
                        <span>•</span>
                        <span>Comp: {selectedSong.composer}</span>
                      </>
                    )}
                    {selectedSong.album && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Disc className="size-3 opacity-70" />
                          {selectedSong.album}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{slides.length} slides</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Adicionar ao Culto button */}
                  {activeEvent && activeEvent.parts.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                          <Plus className="size-3.5" />
                          <span>Adicionar ao Culto</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Escolha a parte do setlist
                        </div>
                        {activeEvent.parts.map((p) => (
                          <DropdownMenuItem
                            key={p.id}
                            className="text-xs cursor-pointer"
                            onClick={() => handleAddSongToActiveCulto(p.id)}
                          >
                            <Layers className="size-3.5 mr-2" />
                            <span className="truncate">{p.title || "Sem título"}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handleAddSongToActiveCulto()}
                      title={activeEvent ? `Adicionar ao culto "${activeEvent.title}"` : "Adicionar ao culto"}
                    >
                      <Plus className="size-3.5" />
                      <span>Adicionar ao Culto</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => editSong(selectedSong.id)}
                  >
                    <Edit3 className="size-3.5" />
                    <span>Editar Letra</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 px-2 cursor-pointer"
                    onClick={() => setDeleteConfirmOpen(true)}
                    title="Excluir música"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Toolbar: View Mode, Theme Preview & Zoom */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-4 py-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Estrofes / Slides
                  </span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-mono">
                    {slides.length}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Botão de Alternar Prévia de Tema */}
                  <Button
                    variant={themePreviewActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setThemePreviewActive(!themePreviewActive)}
                    className="h-7 text-xs gap-1.5 cursor-pointer"
                    title="Visualizar slides com o tema público selecionado"
                  >
                    {themePreviewActive ? (
                      <Eye className="size-3.5" />
                    ) : (
                      <EyeOff className="size-3.5 text-muted-foreground" />
                    )}
                    <span>Tema Público</span>
                  </Button>

                  {/* Seletor de Tema quando ativo */}
                  {themePreviewActive && templateThemes.length > 0 && (
                    <Select
                      value={activeTheme?.guid ?? ""}
                      onValueChange={(guid) => setSelectedThemeGuid(guid)}
                    >
                      <SelectTrigger className="h-7 w-[150px] text-xs">
                        <SelectValue placeholder="Escolher tema..." />
                      </SelectTrigger>
                      <SelectContent align="end" className="w-[180px]">
                        {templateThemes.map((theme) => (
                          <SelectItem
                            key={theme.guid}
                            value={theme.guid}
                            className="text-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{theme.title}</span>
                              {theme.guid === defaultTheme?.guid && (
                                <Star className="size-3 text-amber-500 fill-amber-500 shrink-0 ml-auto" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Controle de Zoom (+ e - para aumentar/diminuir o tamanho dos slides e fazer wrap dinâmico) */}
                  {viewMode === "grid" && (
                    <div className="flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5 gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomOut}
                        disabled={cardMinSize <= 160}
                        className="size-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                        title="Diminuir tamanho dos slides (-)"
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="text-[10px] font-mono font-medium px-1.5 text-muted-foreground select-none tabular-nums">
                        {Math.round((cardMinSize / 220) * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomIn}
                        disabled={cardMinSize >= 460}
                        className="size-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                        title="Aumentar tamanho dos slides (+)"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  )}

                  {/* Alternador Grade / Lista */}
                  <div className="flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("grid")}
                      className="size-6 rounded-sm cursor-pointer"
                      title="Visualização em Grade"
                    >
                      <LayoutGrid className="size-3" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("list")}
                      className="size-6 rounded-sm cursor-pointer"
                      title="Visualização em Lista"
                    >
                      <List className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sections / Slides Viewer Area */}
              <ScrollArea className="flex-1 p-4">
                {loadingSelected ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Carregando estrofes…
                  </div>
                ) : slides.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Nenhuma estrofe cadastrada nesta música.
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === "grid"
                        ? "grid gap-3 pb-8"
                        : "flex flex-col gap-3 max-w-3xl mx-auto pb-8"
                    }
                    style={
                      viewMode === "grid"
                        ? {
                            gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))`,
                          }
                        : undefined
                    }
                  >
                    {slides.map((item) => {
                      const type = item.sectionType;
                      const label =
                        item.label || (type ? SECTION_LABEL[type] : `Slide ${item.index + 1}`);
                      const color = type ? SECTION_COLOR[type] : undefined;

                      const slideProps = activeTheme
                        ? {
                            ...buildProps("lyric", item.slide),
                            title: selectedSong.title || item.slide.title,
                            artist: selectedSong.artist,
                            artista: selectedSong.artist,
                          }
                        : {};

                      return (
                        <div
                          key={`slide-${item.index}`}
                          className={`flex flex-col justify-between overflow-hidden rounded-lg border border-border/70 bg-card/80 p-3 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs ${
                            viewMode === "list" ? "min-h-[80px]" : "min-h-[140px]"
                          }`}
                        >
                          {/* Cabeçalho do Card */}
                          <div className="flex items-center justify-between gap-1.5 mb-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="flex size-5 items-center justify-center rounded bg-muted text-[10px] font-mono font-bold text-muted-foreground tabular-nums">
                                {item.index + 1}
                              </span>

                              {label ? (
                                <Badge
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px] font-medium border"
                                  style={
                                    color
                                      ? {
                                          borderColor: `${color}66`,
                                          backgroundColor: `${color}15`,
                                          color: color,
                                        }
                                      : undefined
                                  }
                                >
                                  {label}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 italic">
                                  Sem rótulo
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] font-mono text-muted-foreground/70">
                              #{item.index + 1}
                            </span>
                          </div>

                          {/* Conteúdo do Slide: Tema Público vs Texto Formatado */}
                          {themePreviewActive && activePreview ? (
                            <div className="relative aspect-video w-full overflow-hidden rounded border border-border/80 bg-black shadow-inner">
                              <ScaledStage
                                theme={activePreview.theme}
                                asset={activePreview.asset}
                                props={slideProps}
                                showBackground={true}
                              />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col justify-center py-1">
                              {item.slide.lines.length > 0 ? (
                                <div className="space-y-1">
                                  {item.slide.lines.map((line, lIdx) => {
                                    if (isCommentLine(line)) {
                                      return (
                                        <div key={lIdx} className="my-0.5">
                                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold italic">
                                            📌 {cleanCommentText(line)}
                                          </span>
                                        </div>
                                      );
                                    }
                                    if (isChordLine(line)) {
                                      return (
                                        <p
                                          key={lIdx}
                                          className="text-[11px] font-mono font-bold text-sky-400 leading-tight whitespace-pre truncate"
                                        >
                                          {line}
                                        </p>
                                      );
                                    }
                                    return (
                                      <p
                                        key={lIdx}
                                        className="text-xs font-normal leading-relaxed text-foreground whitespace-pre-wrap"
                                      >
                                        {line}
                                      </p>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs italic text-muted-foreground/50">
                                  (Slide vazio)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted/30 text-muted-foreground mb-3">
                <Music className="size-7" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Nenhuma música selecionada
              </h4>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Selecione uma música da lista ao lado para visualizar e editar suas estrofes, ou crie uma nova composição.
              </p>
              <Button size="sm" className="mt-4 gap-1.5 text-xs" onClick={startNewSong}>
                <Plus className="size-3.5" />
                <span>Nova Música</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && selectedSong && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">Excluir Música?</DialogTitle>
              <DialogDescription className="text-xs">
                Tem certeza que deseja excluir permanentemente &quot;{selectedSong.title}&quot;? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeleteConfirmed()}
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
