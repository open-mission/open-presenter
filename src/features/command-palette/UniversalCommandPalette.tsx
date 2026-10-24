import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Calendar,
  Command,
  CornerDownLeft,
  Eye,
  EyeOff,
  Film,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Megaphone,
  Monitor,
  Moon,
  Music,
  Plus,
  Radio,
  Settings,
  Sparkles,
  Timer,
  Volume2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import { isTauri } from "@/core/ipc/tauri";
import { openDisplaysWindow, openShortcutsWindow, getBibleChapter } from "@/core/ipc/commands";
import { parseBibleReference, type ParsedBibleReference } from "@/features/bible/bibleParser";
import { matchInstalledBibleVersion, formatBibleVersionAbbrev, formatBibleVersionLabel } from "@/features/bible/bibleUtils";
import { useSongsStore } from "@/features/songs/store";
import { useBibleStore } from "@/features/bible/store";
import { useBackgroundAssets } from "@/features/media-library/assets";
import { useSetlistStore } from "@/features/events-setlists/store";
import { usePreferencesStore } from "@/features/preferences/store";
import { usePresentationStore } from "@/features/presentation/store";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
import { usePreviewLayoutStore } from "@/features/presentation/previewLayoutStore";
import { useCommunicationStore } from "@/features/communication";
import { useUpdatesStore } from "@/features/updates/store";
import { useMediaPlaybackStore } from "@/core/store/mediaPlaybackStore";
import { getISFThumbnail, isIsfBackground } from "@/features/media-shaders/isfEngine";
import type { BackgroundAsset } from "@/features/media-library/types";
import type { BibleVerse } from "@/core/types";
import { useCommandPaletteStore, type PaletteCategory } from "./store";
import {
  addItemToActiveSetlist,
  presentBibleVerseImmediately,
  presentSongImmediately,
  applyMediaImmediately,
} from "./addToSetlist";

interface CommandItem {
  id: string;
  category: PaletteCategory;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  shortcut?: string;
  onExecute: () => void | Promise<void>;
  onPresent?: () => void | Promise<void>;
  onAddToSetlist?: () => void;
  asset?: BackgroundAsset;
}

export function UniversalCommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const initialQuery = useCommandPaletteStore((s) => s.initialQuery);
  const category = useCommandPaletteStore((s) => s.category);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);
  const setCategory = useCommandPaletteStore((s) => s.setCategory);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [versePreview, setVersePreview] = useState<BibleVerse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Dados das lojas
  const songs = useSongsStore((s) => s.songs);
  const activeVersionId = useBibleStore((s) => s.activeVersionId);
  const bibleVersions = useBibleStore((s) => s.versions);
  const { backgrounds, images, videos, audios, shaders } = useBackgroundAssets();


  // Foco inicial e reset
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      setVersePreview(null);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open, initialQuery]);

  // Parser de referência bíblica em tempo real
  const parsedBible = useMemo<ParsedBibleReference | null>(() => {
    return parseBibleReference(query);
  }, [query]);

  // Identificação da versão da bíblia se digitada
  const matchedVersion = useMemo(() => {
    if (!parsedBible?.versionQuery) return null;
    return matchInstalledBibleVersion(bibleVersions, parsedBible.versionQuery);
  }, [parsedBible?.versionQuery, bibleVersions]);

  const effectiveBibleVersionId = matchedVersion ? matchedVersion.id : activeVersionId;

  // Busca do versículo quando detectado
  useEffect(() => {
    if (!parsedBible || !effectiveBibleVersionId) {
      setVersePreview(null);
      return;
    }

    let isCurrent = true;
    const targetVerse = parsedBible.verse ?? 1;
    setPreviewLoading(true);

    getBibleChapter(effectiveBibleVersionId, parsedBible.bookId, parsedBible.chapter)
      .then((verses) => {
        if (!isCurrent) return;
        const found = verses.find((v) => v.verse === targetVerse) ?? verses[0] ?? null;
        setVersePreview(found);
      })
      .catch(() => {
        if (isCurrent) setVersePreview(null);
      })
      .finally(() => {
        if (isCurrent) setPreviewLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [parsedBible, effectiveBibleVersionId]);

  // Lista de resultados filtrados
  const results = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: CommandItem[] = [];

    // 1. Bíblia (se detectou referência)
    if (parsedBible && (category === "all" || category === "bible")) {
      const vNum = parsedBible.verse ?? 1;
      items.push({
        id: `bible:${parsedBible.bookId}:${parsedBible.chapter}:${vNum}`,
        category: "bible",
        title: `${parsedBible.bookName} ${parsedBible.chapter}:${vNum}`,
        subtitle: matchedVersion
          ? `Versão detectada: ${formatBibleVersionLabel(matchedVersion)}`
          : `Versão ativa: ${effectiveBibleVersionId}`,
        icon: BookOpen,
        iconColor: "text-amber-400",
        onExecute: async () => {
          closePalette();
          if (matchedVersion && matchedVersion.id !== effectiveBibleVersionId) {
            await useBibleStore.getState().setActiveVersion(matchedVersion.id);
          }
          usePanelLayoutStore.getState().setMediaOpen(true);
          usePanelLayoutStore.getState().setMediaTab("bible");
          await useBibleStore.getState().goToVerse(
            parsedBible.bookId,
            parsedBible.chapter,
            vNum,
            false,
          );
        },
        onPresent: () => {
          closePalette();
          void presentBibleVerseImmediately(
            parsedBible.bookId,
            parsedBible.chapter,
            vNum,
            effectiveBibleVersionId,
          );
        },
        onAddToSetlist: () => {
          closePalette();
          addItemToActiveSetlist({
            scripture: {
              versionId: effectiveBibleVersionId,
              bookId: parsedBible.bookId,
              bookName: parsedBible.bookName,
              chapter: parsedBible.chapter,
              verse: vNum,
              part: 0,
              totalParts: 1,
            },
          });
        },
      });
    }

    // 2. Músicas
    if (category === "all" || category === "songs") {
      const matchedSongs = (q ? songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)) : songs.slice(0, 5));
      for (const song of matchedSongs.slice(0, 8)) {
        items.push({
          id: `song:${song.id}`,
          category: "songs",
          title: song.title,
          subtitle: song.artist ? `Por ${song.artist}` : "Música da biblioteca",
          icon: Music,
          iconColor: "text-primary",
          onExecute: () => {
            closePalette();
            usePanelLayoutStore.getState().setMediaOpen(true);
            usePanelLayoutStore.getState().setMediaTab("songs");
          },
          onPresent: () => {
            closePalette();
            void presentSongImmediately(song.id);
          },
          onAddToSetlist: () => {
            closePalette();
            addItemToActiveSetlist({ song });
          },
        });
      }
    }

    // 3. Mídias (Vídeos, Imagens, Áudios, Shaders)
    if (category === "all" || category === "media") {
      const allMedia = [...backgrounds, ...images, ...videos, ...audios, ...shaders];
      const matchedMedia = q
        ? allMedia.filter((m) => m.name.toLowerCase().includes(q))
        : allMedia.slice(0, 5);

      for (const m of matchedMedia.slice(0, 8)) {
        const isShader = m.kind === "shader" || m.source.startsWith("isf:") || isIsfBackground(m.source);
        const Icon = isShader
          ? Sparkles
          : m.kind === "video"
            ? Film
            : m.kind === "audio"
              ? Volume2
              : ImageIcon;

        items.push({
          id: `media:${m.id}`,
          category: "media",
          title: m.name,
          subtitle: isShader ? "Shader ISF 2.0" : m.kind === "video" ? "Vídeo de fundo" : m.kind === "audio" ? "Áudio" : "Imagem de fundo",
          icon: Icon,
          iconColor: isShader ? "text-purple-400" : "text-emerald-400",
          asset: m,
          onExecute: () => {
            closePalette();
            usePanelLayoutStore.getState().setMediaOpen(true);
            const targetTab = isShader
              ? "shaders"
              : m.kind === "video"
              ? "videos"
              : m.kind === "audio"
              ? "audios"
              : "images";
            usePanelLayoutStore.getState().setMediaTab(targetTab);
          },
          onPresent: () => {
            closePalette();
            applyMediaImmediately(m);
          },
          onAddToSetlist: m.kind !== "shader" ? () => {
            closePalette();
            addItemToActiveSetlist({
              media: {
                kind: m.kind === "video" ? "video" : m.kind === "audio" ? "audio" : "image",
                title: m.name,
                path: m.source,
                fit: "cover",
              },
            });
          } : undefined,
        });
      }
    }

    // 4. Comandos e Ações do Sistema
    if (category === "all" || category === "commands") {
      const systemCommands: CommandItem[] = [
        {
          id: "cmd:search-online",
          category: "commands",
          title: "Buscar Música na Internet…",
          subtitle: "Pesquisar letras online via Vagalume, Holyrics ou LRC",
          icon: Globe,
          iconColor: "text-sky-400",
          shortcut: "⇧⌘F",
          onExecute: () => {
            closePalette();
            useSongsStore.getState().openOnlineSearch();
          },
        },
        {
          id: "cmd:new-song",
          category: "commands",
          title: "Nova Música",
          subtitle: "Criar e editar uma nova letra de música",
          icon: Plus,
          iconColor: "text-primary",
          shortcut: "⌘N",
          onExecute: () => {
            closePalette();
            useSongsStore.getState().startNewSong();
          },
        },
        {
          id: "cmd:new-event",
          category: "commands",
          title: "Novo Culto / Evento…",
          subtitle: "Criar uma nova data e programação de culto",
          icon: Calendar,
          iconColor: "text-amber-400",
          shortcut: "⌘E",
          onExecute: () => {
            closePalette();
            useSetlistStore.getState().openNewEventDialog();
          },
        },
        {
          id: "cmd:agenda",
          category: "commands",
          title: "Abrir Agenda de Eventos",
          subtitle: "Visualizar e gerenciar o calendário de cultos",
          icon: Calendar,
          iconColor: "text-emerald-400",
          onExecute: () => {
            closePalette();
            useSetlistStore.getState().openAgenda();
          },
        },
        {
          id: "cmd:blackout",
          category: "commands",
          title: "Alternar Tela Preta (Blackout)",
          subtitle: "Oculta temporariamente todas as projeções com fundo preto",
          icon: Moon,
          iconColor: "text-red-400",
          shortcut: "B",
          onExecute: () => {
            closePalette();
            void usePresentationStore.getState().toggleBlackout();
          },
        },
        {
          id: "cmd:clear",
          category: "commands",
          title: "Limpar Texto (Clear)",
          subtitle: "Oculta apenas a letra/texto preservando o plano de fundo",
          icon: EyeOff,
          iconColor: "text-amber-400",
          shortcut: "C",
          onExecute: () => {
            closePalette();
            void usePresentationStore.getState().toggleClear();
          },
        },
        {
          id: "cmd:show-bg",
          category: "commands",
          title: "Exibir Plano de Fundo",
          subtitle: "Restaura o fundo e remove textos",
          icon: ImageIcon,
          iconColor: "text-blue-400",
          shortcut: "F",
          onExecute: () => {
            closePalette();
            void usePresentationStore.getState().showBackground();
          },
        },
        {
          id: "cmd:toggle-monitors",
          category: "commands",
          title: "Alternar Painel de Previews dos Monitores",
          subtitle: "Exibir ou ocultar a grade multiviewer com os monitores",
          icon: Eye,
          iconColor: "text-primary",
          shortcut: "⌥P",
          onExecute: () => {
            closePalette();
            usePanelLayoutStore.getState().toggleMonitors();
          },
        },
        {
          id: "cmd:toggle-media",
          category: "commands",
          title: "Alternar Painel de Mídias",
          subtitle: "Exibir ou recolher a gaveta inferior de temas e mídias",
          icon: Layers,
          iconColor: "text-purple-400",
          shortcut: "⌥M",
          onExecute: () => {
            closePalette();
            const s = usePanelLayoutStore.getState();
            s.setMediaOpen(!s.mediaOpen);
          },
        },
        {
          id: "cmd:alerts-tab",
          category: "commands",
          title: "Exibir Aba de Avisos",
          subtitle: "Focar nos avisos em tempo real no painel de ajustes",
          icon: Megaphone,
          iconColor: "text-amber-400",
          onExecute: () => {
            closePalette();
            if (!usePanelLayoutStore.getState().monitorsVisible) {
              usePanelLayoutStore.getState().toggleMonitors();
            }
            usePreviewLayoutStore.getState().setAdjustmentsTab("alerts");
          },
        },
        {
          id: "cmd:timers-tab",
          category: "commands",
          title: "Exibir Aba de Cronômetros & Timers",
          subtitle: "Focar nos cronômetros regressivos para o palco e orador",
          icon: Timer,
          iconColor: "text-emerald-400",
          onExecute: () => {
            closePalette();
            if (!usePanelLayoutStore.getState().monitorsVisible) {
              usePanelLayoutStore.getState().toggleMonitors();
            }
            usePreviewLayoutStore.getState().setAdjustmentsTab("timers");
          },
        },
        {
          id: "cmd:communication-window",
          category: "commands",
          title: "Abrir Janela de Comunicação & Avisos…",
          subtitle: "Abre a janela destacada para mensagens ao palco e telão",
          icon: Megaphone,
          iconColor: "text-muted-foreground",
          shortcut: "⌘M",
          onExecute: () => {
            closePalette();
            void useCommunicationStore.getState().openWindow();
          },
        },
        {
          id: "cmd:displays-window",
          category: "commands",
          title: "Gerenciar Saídas e Telas…",
          subtitle: "Configurar monitores físicos, NDI e janelas de projeção",
          icon: Monitor,
          iconColor: "text-muted-foreground",
          onExecute: () => {
            closePalette();
            if (isTauri()) {
              void openDisplaysWindow();
            } else {
              window.open("#/displays", "_blank");
            }
          },
        },
        {
          id: "cmd:preferences",
          category: "commands",
          title: "Preferências do Aplicativo…",
          subtitle: "Configurações gerais, saídas de áudio, temas e importações",
          icon: Settings,
          iconColor: "text-muted-foreground",
          shortcut: "⌘,",
          onExecute: () => {
            closePalette();
            usePreferencesStore.getState().openPreferences();
          },
        },
        {
          id: "cmd:shortcuts",
          category: "commands",
          title: "Atalhos de Teclado…",
          subtitle: "Visualizar todos os atalhos disponíveis no sistema",
          icon: Command,
          iconColor: "text-muted-foreground",
          shortcut: "⌘/",
          onExecute: () => {
            closePalette();
            if (isTauri()) {
              void openShortcutsWindow();
            } else {
              window.open("/#/shortcuts", "_blank");
            }
          },
        },
        {
          id: "cmd:whats-new",
          category: "commands",
          title: "Novidades desta Versão…",
          subtitle: "Ver notas de atualização e novos recursos",
          icon: Sparkles,
          iconColor: "text-amber-400",
          onExecute: () => {
            closePalette();
            useUpdatesStore.getState().openWhatsNew();
          },
        },
        {
          id: "cmd:toggle-audio",
          category: "commands",
          title: "Reproduzir / Pausar Áudio de Fundo",
          subtitle: "Alterna a reprodução da trilha sonora de fundo",
          icon: Volume2,
          iconColor: "text-emerald-400",
          onExecute: () => {
            closePalette();
            useMediaPlaybackStore.getState().togglePlay();
          },
        },
      ];

      const filteredCommands = q
        ? systemCommands.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.subtitle?.toLowerCase().includes(q),
          )
        : systemCommands;

      items.push(...filteredCommands.slice(0, 10));
    }

    return items;
  }, [
    query,
    category,
    parsedBible,
    matchedVersion,
    effectiveBibleVersionId,
    songs,
    backgrounds,
    images,
    videos,
    audios,
    shaders,
    closePalette,
  ]);

  // Limita o cursor de seleção
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, category]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = results[selectedIndex];
      if (!current) return;

      if (e.shiftKey) {
        if (current.onPresent) {
          void current.onPresent();
        } else if (current.onAddToSetlist) {
          current.onAddToSetlist();
        } else {
          void current.onExecute();
        }
      } else {
        void current.onExecute();
      }
    } else if (e.key === "Escape") {
      closePalette();
    }
  }

  // Rola para o item ativo automaticamente
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closePalette()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl w-full max-w-[94vw] p-0 gap-0 overflow-hidden border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Paleta Universal de Comandos (⌘K)</DialogTitle>
        </DialogHeader>

        {/* Input Bar Superior estilo Spotlight */}
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 bg-muted/20">
          <Sparkles className="size-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="O que você deseja fazer? (ex: João 3:16, Santo Espírito, avisos, telão, fundo)..."
            className="flex-1 bg-transparent text-base md:text-lg font-medium placeholder:text-muted-foreground outline-none text-foreground"
          />

          <div className="flex items-center gap-2 shrink-0">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md"
              >
                <X className="size-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-6 items-center rounded border border-border/80 bg-muted px-2 font-mono text-xs text-muted-foreground">
              Esc
            </kbd>
          </div>
        </div>

        {/* Filtros por Categorias Rápidas */}
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border/40 bg-muted/10 overflow-x-auto select-none">
          {(
            [
              { id: "all", label: "Tudo", icon: Command },
              { id: "songs", label: "Músicas", icon: Music },
              { id: "bible", label: "Bíblia", icon: BookOpen },
              { id: "media", label: "Mídias", icon: Film },
              { id: "commands", label: "Comandos", icon: Sparkles },
            ] as const
          ).map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Prévia Especial de Versículo Bíblico Detectado */}
        {parsedBible && (
          <div className="mx-5 my-3 rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-2 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  📖
                </span>
                <span className="font-bold text-sm text-foreground">
                  {parsedBible.bookName} {parsedBible.chapter}:{parsedBible.verse ?? 1}
                </span>
                {matchedVersion ? (
                  <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    ✓ {formatBibleVersionAbbrev(matchedVersion)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {formatBibleVersionAbbrev({ id: effectiveBibleVersionId })}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    closePalette();
                    if (matchedVersion && matchedVersion.id !== effectiveBibleVersionId) {
                      await useBibleStore.getState().setActiveVersion(matchedVersion.id);
                    }
                    usePanelLayoutStore.getState().setMediaOpen(true);
                    usePanelLayoutStore.getState().setMediaTab("bible");
                    await useBibleStore.getState().goToVerse(
                      parsedBible.bookId,
                      parsedBible.chapter,
                      parsedBible.verse ?? 1,
                      false,
                    );
                  }}
                  className="h-7 text-xs font-semibold px-2 cursor-pointer"
                  title="Abrir versículo na aba da Bíblia (Enter)"
                >
                  <BookOpen className="size-3 mr-1" />
                  Bíblia (↵)
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    closePalette();
                    void presentBibleVerseImmediately(
                      parsedBible.bookId,
                      parsedBible.chapter,
                      parsedBible.verse ?? 1,
                      effectiveBibleVersionId,
                    );
                  }}
                  className="h-7 text-xs font-semibold px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  title="Apresentar versículo ao vivo (Shift+Enter)"
                >
                  <Radio className="size-3 mr-1" />
                  Projetar (⇧↵)
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    closePalette();
                    addItemToActiveSetlist({
                      scripture: {
                        versionId: effectiveBibleVersionId,
                        bookId: parsedBible.bookId,
                        bookName: parsedBible.bookName,
                        chapter: parsedBible.chapter,
                        verse: parsedBible.verse ?? 1,
                        part: 0,
                        totalParts: 1,
                      },
                    });
                  }}
                  className="h-7 text-xs font-semibold px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                  title="Adicionar versículo à programação"
                >
                  <Plus className="size-3 mr-1" />
                  Setlist
                </Button>
              </div>
            </div>

            {previewLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="size-3.5 animate-spin" />
                Carregando texto do versículo...
              </div>
            ) : versePreview ? (
              <p className="text-xs leading-relaxed text-foreground/90 font-serif italic border-l-2 border-primary/40 pl-2">
                "{versePreview.text}"
              </p>
            ) : null}
          </div>
        )}

        {/* Lista de Resultados */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2.5 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
              <p>Nenhum resultado encontrado para "{query}".</p>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closePalette();
                    useSongsStore.getState().openOnlineSearch();
                  }}
                  className="h-8 text-xs cursor-pointer"
                >
                  <Globe className="size-3.5 mr-1.5" />
                  Buscar Música na Internet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closePalette();
                    useSongsStore.getState().startNewSong();
                  }}
                  className="h-8 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Criar Nova Música
                </Button>
              </div>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={() => {
                    setSelectedIndex(idx);
                    void item.onExecute();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all select-none",
                    isSelected
                      ? "bg-primary/10 text-foreground font-medium ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.asset ? (
                      <div className="size-8 rounded overflow-hidden shrink-0 bg-zinc-900 border border-border/60">
                        {item.asset.kind === "image" ? (
                          <img src={item.asset.source} alt="" className="size-full object-cover" />
                        ) : (
                          <div
                            className="size-full"
                            style={{
                              backgroundImage: `url(${getISFThumbnail(item.asset.source) || ""})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg bg-muted/60 border border-border/50 shrink-0",
                          item.iconColor,
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.onPresent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void item.onPresent!();
                        }}
                        className={cn(
                          "hidden sm:flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        title="Apresentar ao vivo imediatamente (Shift+Enter)"
                      >
                        <Radio className="size-3" />
                        Ao Vivo (⇧↵)
                      </button>
                    )}

                    {item.onAddToSetlist && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onAddToSetlist!();
                        }}
                        className={cn(
                          "hidden sm:flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary/20 text-primary hover:bg-primary/30"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        title="Adicionar à programação"
                      >
                        <Plus className="size-3" />
                        Setlist
                      </button>
                    )}

                    {item.shortcut ? (
                      <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    ) : (
                      <div
                        className={cn(
                          "size-5 items-center justify-center rounded",
                          isSelected ? "flex text-primary" : "hidden group-hover:flex text-muted-foreground",
                        )}
                        title="Ir para o item (Enter)"
                      >
                        <CornerDownLeft className="size-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Dicas de Atalhos */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 bg-muted/20 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="bg-background px-1.5 py-0.5 rounded border text-[10px]">↑</kbd>
              <kbd className="bg-background px-1.5 py-0.5 rounded border text-[10px]">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-background px-1.5 py-0.5 rounded border text-[10px]">↵</kbd>
              ir para o item
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-background px-1.5 py-0.5 rounded border text-[10px]">⇧↵</kbd>
              apresentar ao vivo
            </span>
          </div>

          <span className="hidden md:inline font-mono text-[10px]">
            Open Presenter
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
