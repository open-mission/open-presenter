import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Eye,
  Folder,
  FolderOpen,
  FolderPlus,
  Music,
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  getSetting,
  getSong,
  listSongs,
  openSongEditor,
  setSetting,
} from "@/core/ipc/commands";
import { buildSongSlides, type RunnerSlide } from "@/core/lib/lyrics";
import { SECTION_COLOR, SECTION_LABEL } from "@/core/config/lyrics";
import { useSongDefaultsStore } from "@/core/store/songDefaultsStore";
import type { Song, SongSummary } from "@/core/types";
import { useSetlistStore } from "@/features/events-setlists/store";
import { usePresentationStore } from "@/features/presentation/store";
import { useSongsStore } from "@/features/songs/store";
import { clearAssetDragData, setAssetDragData } from "../dnd";

interface SongFolder {
  id: string;
  name: string;
  songIds: string[];
}

const SETTING_FOLDERS_KEY = "media_song_folders";
const STORAGE_FOLDERS_KEY = "open_presenter_media_song_folders";
const STORAGE_SIDE_WIDTH_KEY = "open_presenter_media_songs_side_width";

const DEFAULT_FOLDERS: SongFolder[] = [
  { id: "louvor", name: "Louvor & Adoração", songIds: [] },
  { id: "comunhao", name: "Comunhão & Ceia", songIds: [] },
  { id: "ofertorio", name: "Oferta & Dízimo", songIds: [] },
];

function loadSavedSideWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_SIDE_WIDTH_KEY);
    if (!raw) return 360;
    const num = parseInt(raw, 10);
    return Math.max(280, Math.min(650, isNaN(num) ? 360 : num));
  } catch {
    return 360;
  }
}

export function MediaSongsBrowser() {
  const allStoreSongs = useSongsStore((s) => s.songs);
  const loadStoreSongs = useSongsStore((s) => s.load);
  const deleteSongFromStore = useSongsStore((s) => s.deleteSong);
  const appendImprevistoSong = useSetlistStore((s) => s.appendImprevistoSong);
  const addEmptySlideAtStart = useSongDefaultsStore(
    (s) => s.addEmptySlideAtStart,
  );
  const liveSlideId = usePresentationStore((s) => s.live.content.id);
  const previewSlideId = usePresentationStore((s) => s.preview?.id);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [queriedSongs, setQueriedSongs] = useState<SongSummary[] | null>(null);

  const [folders, setFolders] = useState<SongFolder[]>(DEFAULT_FOLDERS);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<SongSummary | null>(null);

  // Estado da música selecionada para exibição dos slides no painel lateral (side)
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedFullSong, setSelectedFullSong] = useState<Song | null>(null);
  const [loadingSong, setLoadingSong] = useState(false);

  // Redimensionamento do painel lateral (side panel width)
  const [sideWidth, setSideWidth] = useState<number>(loadSavedSideWidth);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ pointerX: 0, width: sideWidth });

  // 1. Carrega pastas salvas no banco SQLite (ou fallback localStorage)
  useEffect(() => {
    let active = true;
    async function loadFolders() {
      try {
        let raw: string | null = null;
        try {
          raw = await getSetting(SETTING_FOLDERS_KEY);
        } catch {
          // ignore
        }
        if (!raw) {
          raw = localStorage.getItem(STORAGE_FOLDERS_KEY);
        }
        if (raw && active) {
          const parsed = JSON.parse(raw) as SongFolder[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFolders(parsed);
            return;
          }
        }
      } catch {
        // fallback to default
      }
      if (active) setFolders(DEFAULT_FOLDERS);
    }

    void loadFolders();
    void loadStoreSongs();

    return () => {
      active = false;
    };
  }, [loadStoreSongs]);

  // Salva pastas no banco SQLite (settings) e espelha no localStorage
  const saveFolders = async (newFolders: SongFolder[]) => {
    setFolders(newFolders);
    const json = JSON.stringify(newFolders);
    try {
      await setSetting(SETTING_FOLDERS_KEY, json);
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(STORAGE_FOLDERS_KEY, json);
    } catch {
      // ignore
    }
  };

  // 2. Debounce na busca de músicas para consultar o banco SQLite via IPC (busca completa incluindo letras)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    async function executeSearch() {
      if (!debouncedQuery) {
        setQueriedSongs(null);
        return;
      }
      try {
        // listSongs(debouncedQuery) pesquisa na tabela songs E na tabela song_lyrics por linhas
        const results = await listSongs(debouncedQuery);
        if (active) {
          setQueriedSongs(results);
        }
      } catch {
        if (active) {
          setQueriedSongs(null);
        }
      }
    }
    void executeSearch();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) ?? null,
    [folders, activeFolderId],
  );

  // Lista efetiva de músicas (respeitando busca por letra no SQLite + filtro de pasta)
  const displaySongs = useMemo(() => {
    let list = queriedSongs !== null ? queriedSongs : allStoreSongs;
    if (activeFolder) {
      const ids = new Set(activeFolder.songIds);
      list = list.filter((s) => ids.has(s.id));
    }
    return list;
  }, [queriedSongs, allStoreSongs, activeFolder]);

  // Carrega e gera slides da música selecionada para o painel lateral
  const sideSlides: RunnerSlide[] = useMemo(() => {
    if (!selectedFullSong) return [];
    return buildSongSlides(selectedFullSong, { addEmptySlideAtStart });
  }, [selectedFullSong, addEmptySlideAtStart]);

  const handleSelectSong = async (songSummary: SongSummary) => {
    setSelectedSongId(songSummary.id);
    setLoadingSong(true);
    try {
      const full = await getSong(songSummary.id);
      if (!full) return;
      setSelectedFullSong(full);
      useSongsStore.getState().setAdHocSong(full);

      // Coloca automaticamente o primeiro slide no monitor de Preview em cima
      const slides = buildSongSlides(full, { addEmptySlideAtStart });
      if (slides.length > 0 && slides[0]?.slide) {
        usePresentationStore.getState().setPreview(slides[0].slide);
      }
    } catch (err) {
      toast.error(`Falha ao carregar estrofes: ${String(err)}`);
    } finally {
      setLoadingSong(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const newFolder: SongFolder = {
      id: `folder_${Date.now()}`,
      name,
      songIds: [],
    };
    const updated = [...folders, newFolder];
    await saveFolders(updated);
    setActiveFolderId(newFolder.id);
    setNewFolderName("");
    setCreateDialogOpen(false);
    toast.success(`Pasta "${name}" criada e salva no banco de dados.`);
  };

  const toggleSongInFolder = async (folderId: string, songId: string) => {
    const updated = folders.map((f) => {
      if (f.id !== folderId) return f;
      const has = f.songIds.includes(songId);
      return {
        ...f,
        songIds: has ? f.songIds.filter((id) => id !== songId) : [...f.songIds, songId],
      };
    });
    await saveFolders(updated);
    const targetFolder = folders.find((f) => f.id === folderId);
    const isNowIn = updated.find((f) => f.id === folderId)?.songIds.includes(songId);
    if (targetFolder) {
      toast.success(
        isNowIn
          ? `Música adicionada à pasta "${targetFolder.name}".`
          : `Música removida da pasta "${targetFolder.name}".`,
      );
    }
  };

  const handlePresentLive = async (songSummary: SongSummary, startingSlideIndex = 0) => {
    try {
      const fullSong = await getSong(songSummary.id);
      if (!fullSong) {
        toast.error("Música não encontrada.");
        return;
      }
      setSelectedSongId(songSummary.id);
      setSelectedFullSong(fullSong);
      useSongsStore.getState().setAdHocSong(fullSong);

      const slides = buildSongSlides(fullSong, { addEmptySlideAtStart });
      if (slides.length > 0) {
        const idx = Math.max(0, Math.min(slides.length - 1, startingSlideIndex));
        const currentSlide = slides[idx]!.slide;
        const nextSlide = slides[idx + 1]?.slide ?? null;

        await usePresentationStore.getState().publishLive(currentSlide, nextSlide);
        usePresentationStore.getState().setPreview(currentSlide);
        toast.success(`"${fullSong.title}" agora está Ao Vivo!`);
      }
    } catch (err) {
      toast.error(
        `Falha ao apresentar música: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleAddToSetlist = async (songSummary: SongSummary) => {
    try {
      await appendImprevistoSong(songSummary.id);
      toast.success(`"${songSummary.title}" adicionada à programação.`);
    } catch (err) {
      toast.error(
        `Falha ao adicionar: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleSlideClick = (slide: RunnerSlide) => {
    usePresentationStore.getState().setPreview(slide.slide);
  };

  const handleSlideDoubleClick = async (index: number) => {
    if (!sideSlides[index]) return;
    const cur = sideSlides[index]!.slide;
    const next = sideSlides[index + 1]?.slide ?? null;
    await usePresentationStore.getState().publishLive(cur, next);
    usePresentationStore.getState().setPreview(cur);
  };

  const handleDeleteSong = (song: SongSummary) => {
    setSongToDelete(song);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSong = async () => {
    if (!songToDelete) return;
    const ok = await deleteSongFromStore(songToDelete.id);
    if (ok) {
      // Remove da seleção se estava aberta
      if (selectedSongId === songToDelete.id) {
        setSelectedSongId(null);
        setSelectedFullSong(null);
      }
      // Remove de todas as pastas
      const updatedFolders = folders.map((f) => ({
        ...f,
        songIds: f.songIds.filter((id) => id !== songToDelete.id),
      }));
      await saveFolders(updatedFolders);
      // Atualiza busca
      if (queriedSongs) {
        setQueriedSongs((prev) => (prev ? prev.filter((s) => s.id !== songToDelete.id) : null));
      }
      toast.success(`Música "${songToDelete.title}" excluída com sucesso.`);
    } else {
      toast.error("Não foi possível excluir a música.");
    }
    setDeleteConfirmOpen(false);
    setSongToDelete(null);
  };

  // Funções de redimensionamento do painel lateral (arrasto pela borda esquerda)
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeStart.current = {
      pointerX: e.clientX,
      width: sideWidth,
    };
    setIsResizing(true);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    // Como o painel fica à direita, arrastar para a esquerda aumenta a largura
    const delta = resizeStart.current.pointerX - e.clientX;
    const newWidth = Math.max(280, Math.min(650, resizeStart.current.width + delta));
    setSideWidth(newWidth);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    setIsResizing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    try {
      localStorage.setItem(STORAGE_SIDE_WIDTH_KEY, sideWidth.toString());
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 gap-0 overflow-hidden relative">
      {/* Coluna Principal: Pastas, Busca e Grade de Músicas */}
      <div className="flex flex-1 min-w-0 flex-col gap-2.5 overflow-y-auto pr-1">
        {/* Barra de Pastas / Categorias */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                activeFolderId === null
                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Folder className="size-3.5" />
              <span>Todas ({allStoreSongs.length})</span>
            </button>

            {folders.map((folder) => {
              const isActive = activeFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <FolderOpen className="size-3.5 text-amber-500/80 shrink-0" />
                  <span className="truncate max-w-[140px]">{folder.name}</span>
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[9px] font-mono text-muted-foreground"
                  >
                    {folder.songIds.length}
                  </Badge>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer shrink-0"
            title="Criar nova pasta de músicas salva no banco"
          >
            <FolderPlus className="size-3.5" />
            <span>Nova Pasta</span>
          </Button>
        </div>

        {/* Busca de Músicas com suporte completo a Título, Artista e Letras (SQLite) */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar música por título, artista ou qualquer trecho da letra…"
            className="h-7 pl-8 pr-7 text-xs bg-muted/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Lista de Músicas */}
        {displaySongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Music className="size-8 stroke-1 text-muted-foreground/40 mb-1" />
            <p className="text-xs font-medium">Nenhuma música encontrada</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              {activeFolder
                ? `A pasta "${activeFolder.name}" está vazia. Adicione músicas pelo botão ou menu de contexto.`
                : "Verifique o termo de busca ou cadastre novas músicas."}
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-2 ${
              selectedSongId
                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {displaySongs.map((song) => {
              const inFolder = activeFolder?.songIds.includes(song.id) ?? false;
              const isSelected = selectedSongId === song.id;

              return (
                <ContextMenu key={song.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      draggable
                      onDragStart={(event) =>
                        setAssetDragData(event, { type: "song", song })
                      }
                      onDragEnd={() => clearAssetDragData()}
                      onClick={() => void handleSelectSong(song)}
                      onDoubleClick={() => void handlePresentLive(song)}
                      className={`group flex flex-col justify-between rounded-lg border p-2.5 shadow-2xs transition-all select-none cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                      title="Arraste para a Programação · 1 clique: ver slides · 2 cliques: apresentar Ao Vivo · Botão direito: Opções"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {song.title}
                          </span>
                          <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0 font-mono">
                            {song.artist || "Geral"}
                          </Badge>
                        </div>
                        {song.composer && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {song.composer}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/40 mt-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handlePresentLive(song);
                            }}
                            className="h-6 gap-1 px-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer font-medium"
                            title="Projetar música ao vivo (ou duplo clique)"
                          >
                            <Radio className="size-2.5" />
                            Ao Vivo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAddToSetlist(song);
                            }}
                            className="h-6 px-1.5 text-[10px] cursor-pointer"
                            title="Adicionar à programação do culto"
                          >
                            + Programação
                          </Button>
                        </div>

                        {activeFolder && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleSongInFolder(activeFolder.id, song.id);
                            }}
                            className={`h-6 px-1.5 text-[10px] cursor-pointer ${
                              inFolder
                                ? "text-destructive hover:bg-destructive/15"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={inFolder ? "Remover da pasta" : "Adicionar à pasta"}
                          >
                            {inFolder ? "Remover" : "+ Pasta"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  {/* Menu de Contexto (Botão Direito) na Música */}
                  <ContextMenuContent className="w-56 text-xs">
                    <ContextMenuItem onSelect={() => void handlePresentLive(song)}>
                      <Radio className="size-3.5 mr-2 text-emerald-500" />
                      <span>Apresentar Ao Vivo</span>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void handleSelectSong(song)}>
                      <Eye className="size-3.5 mr-2 text-primary" />
                      <span>Ver Slides no Painel Lateral</span>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void handleAddToSetlist(song)}>
                      <Plus className="size-3.5 mr-2" />
                      <span>Adicionar à Programação</span>
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {/* Submenu de Mover/Adicionar a Pastas */}
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Folder className="size-3.5 mr-2 text-amber-500" />
                        <span>Pastas da Música</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-52 text-xs">
                        {folders.length === 0 ? (
                          <div className="p-2 text-muted-foreground text-[11px] italic">
                            Nenhuma pasta cadastrada.
                          </div>
                        ) : (
                          folders.map((f) => {
                            const isIncluded = f.songIds.includes(song.id);
                            return (
                              <ContextMenuCheckboxItem
                                key={f.id}
                                checked={isIncluded}
                                onCheckedChange={() => void toggleSongInFolder(f.id, song.id)}
                              >
                                <span className="truncate">{f.name}</span>
                              </ContextMenuCheckboxItem>
                            );
                          })
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => setCreateDialogOpen(true)}>
                          <FolderPlus className="size-3.5 mr-2" />
                          <span>Nova Pasta…</span>
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuSeparator />

                    <ContextMenuItem onSelect={() => void openSongEditor(song.id)}>
                      <Pencil className="size-3.5 mr-2 text-muted-foreground" />
                      <span>Editar Música</span>
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    <ContextMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/15"
                      onSelect={() => handleDeleteSong(song)}
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      <span>Excluir Música</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </div>

      {/* Painel Lateral ("Side"): Slides da Música Selecionada com Redimensionamento */}
      {selectedSongId && (
        <div className="flex h-full shrink-0 items-stretch select-none">
          {/* Borda Esquerda para Arrastar e Redimensionar a Largura do Painel Lateral */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar painel lateral de estrofes"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className={`group flex w-2.5 items-center justify-center cursor-col-resize hover:bg-primary/20 transition-colors z-10 ${
              isResizing ? "bg-primary/30" : "bg-transparent"
            }`}
            title="Arraste para redimensionar a largura dos slides"
          >
            <div
              className={`h-8 w-1 rounded-full transition-colors ${
                isResizing ? "bg-primary" : "bg-border group-hover:bg-primary/60"
              }`}
            />
          </div>

          <aside
            aria-label="Slides da música selecionada"
            style={{ width: `${sideWidth}px` }}
            className="flex h-full flex-col rounded-lg border border-border bg-card/60 overflow-hidden shadow-sm animate-in slide-in-from-right duration-200"
          >
            {/* Header do Painel Lateral */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Music className="size-3.5 text-primary shrink-0" />
                  <h3 className="truncate text-xs font-semibold text-foreground">
                    {selectedFullSong?.title ?? "Carregando…"}
                  </h3>
                </div>
                <p className="truncate text-[10px] text-muted-foreground">
                  {selectedFullSong?.artist || "Artista desconhecido"} ·{" "}
                  <span className="font-mono">{sideSlides.length} estrofes</span>
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedFullSong && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handlePresentLive(selectedFullSong)}
                      className="h-6 gap-1 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
                      title="Apresentar música ao vivo"
                    >
                      <Radio className="size-2.5" />
                      Ao Vivo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAddToSetlist(selectedFullSong)}
                      className="h-6 px-1.5 text-[10px] cursor-pointer"
                      title="Adicionar à programação do culto"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setSelectedSongId(null);
                    setSelectedFullSong(null);
                  }}
                  className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Fechar painel de slides"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="bg-muted/15 px-3 py-1 text-[10px] text-muted-foreground border-b border-border/40 flex items-center justify-between">
              <span>
                1 clique: <span className="text-primary font-medium">Preview</span> · 2 cliques: <span className="text-emerald-500 font-medium">Ao Vivo</span>.
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/60">{sideWidth}px</span>
            </div>

            {/* Lista de Slides da Música */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              {loadingSong ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Carregando estrofes…
                </p>
              ) : sideSlides.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Nenhuma estrofe encontrada nesta música.
                </p>
              ) : (
                sideSlides.map((item, idx) => {
                  const isLive = liveSlideId === item.slide.id;
                  const isPreview = previewSlideId === item.slide.id;
                  const sectionType = item.sectionType ?? "verse";
                  const badgeColor = SECTION_COLOR[sectionType] ?? "#3b82f6";
                  const badgeLabel = item.label ?? (sectionType ? SECTION_LABEL[sectionType] : null) ?? "Estrofe";

                  return (
                    <div
                      key={`${item.slide.id}-${idx}`}
                      onClick={() => handleSlideClick(item)}
                      onDoubleClick={() => void handleSlideDoubleClick(idx)}
                      className={`group relative flex flex-col gap-1 rounded-md border p-2 text-xs transition-all cursor-pointer select-none ${
                        isLive
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500"
                          : isPreview
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                          : "border-border/70 bg-card hover:border-primary/40 hover:bg-accent/40"
                      }`}
                      title="1 clique: Preview em cima | 2 cliques: Projetar Ao Vivo"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: badgeColor }}
                          />
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: badgeColor }}
                          >
                            {badgeLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            #{idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isLive && (
                            <Badge className="h-4 px-1 text-[8px] bg-emerald-600 font-semibold text-white">
                              AO VIVO
                            </Badge>
                          )}
                          {isPreview && !isLive && (
                            <Badge variant="secondary" className="h-4 px-1 text-[8px] text-primary font-semibold">
                              PREVIEW
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Linhas da Letra */}
                      <div className="flex flex-col gap-0.5 text-[11px] text-foreground/90 font-medium leading-relaxed pl-3.5 border-l-2 border-border/40 group-hover:border-primary/40">
                        {item.slide.lines.length === 0 ? (
                          <span className="text-muted-foreground/60 italic text-[10px]">
                            [Slide em branco]
                          </span>
                        ) : (
                          item.slide.lines.map((line, lIdx) => (
                            <p key={lIdx} className="truncate">
                              {line}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Modal Criar Pasta de Músicas */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Nova Pasta de Músicas</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Crie uma pasta temática salva no banco para organizar as músicas:
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex.: Louvor de Celebração"
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFolder();
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateDialogOpen(false)}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreateFolder()}
              disabled={!newFolderName.trim()}
              className="text-xs cursor-pointer"
            >
              Criar Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Música */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5 shrink-0" />
              <DialogTitle className="text-sm font-semibold">Excluir Música</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Tem certeza que deseja excluir permanentemente a música{" "}
              <strong className="text-foreground">"{songToDelete?.title}"</strong>?
              Esta ação removerá a música e suas estrofes do banco de dados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setSongToDelete(null);
              }}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void confirmDeleteSong()}
              className="text-xs cursor-pointer"
            >
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
