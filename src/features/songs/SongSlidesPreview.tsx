import { useState, useMemo, useEffect } from "react";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTION_COLOR } from "@/core/config/lyrics";
import {
  cleanCommentText,
  isChordLine,
  isCommentLine,
  type RunnerSlide,
} from "@/core/lib/lyrics";
import type {
  SectionType,
  SlideKind,
  SlideTheme,
  ThemeAsset,
} from "@/core/types";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { SECTION_OPTIONS } from "./songEditorUtils";

interface SongSlidesPreviewProps {
  slides: RunnerSlide[];
  songTitle: string;
  songArtist: string;
  onSetLabel?: (slideIndex: number, type: SectionType | null) => void;
  kind?: SlideKind;
  asset?: ThemeAsset;
  showLabels?: boolean;
  themeGuid?: string | null;
  onThemeChange?: (themeGuid: string | null) => void;
}

export function SongSlidesPreview({
  slides,
  songTitle,
  songArtist,
  onSetLabel,
  kind = "lyric",
  asset = "music",
  showLabels = true,
  themeGuid,
  onThemeChange,
}: SongSlidesPreviewProps) {
  const effectiveKind = kind;
  const effectiveAsset = asset;
  const lyricsMode = effectiveKind === "lyric";
  const canEditLabels = showLabels && onSetLabel !== undefined;
  const bindingLabel =
    effectiveKind === "lyric"
      ? "letras"
      : effectiveKind === "custom"
      ? "textos"
      : "conteúdo";
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [themePreviewActive, setThemePreviewActive] = useState(
    Boolean(themeGuid),
  );
  const [cardMinSize, setCardMinSize] = useState<number>(220);

  const handleZoomIn = () => {
    setCardMinSize((prev) => Math.min(prev + 40, 460));
  };

  const handleZoomOut = () => {
    setCardMinSize((prev) => Math.max(prev - 40, 160));
  };

  const themes = useSlideThemesStore((s) => s.themes);
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);
  const setBinding = useSlideThemesStore((s) => s.setBinding);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const ensureSeeded = useSlideThemesStore((s) => s.ensureSeeded);

  const defaultTheme = useMemo(
    () => resolveTheme("public", effectiveKind),
    [resolveTheme, themes, effectiveKind],
  );

  const [selectedThemeGuid, setSelectedThemeGuid] = useState<string | null>(
    () => themeGuid ?? defaultTheme?.guid ?? (themes[0]?.guid || null),
  );

  useEffect(() => {
    void ensureSeeded().then(() => void loadThemes());
  }, [ensureSeeded, loadThemes]);

  useEffect(() => {
    if (themeGuid !== undefined) {
      setSelectedThemeGuid(themeGuid ?? defaultTheme?.guid ?? null);
      if (themeGuid) setThemePreviewActive(true);
    } else if (!selectedThemeGuid && defaultTheme) {
      setSelectedThemeGuid(defaultTheme.guid);
    }
  }, [themeGuid, defaultTheme, selectedThemeGuid]);

  const activeTheme: SlideTheme | null = useMemo(() => {
    if (!selectedThemeGuid) return defaultTheme ?? themes[0] ?? null;
    return themes.find((t) => t.guid === selectedThemeGuid) ?? defaultTheme ?? themes[0] ?? null;
  }, [selectedThemeGuid, themes, defaultTheme]);

  const isCurrentThemeDefault =
    activeTheme && defaultTheme && activeTheme.guid === defaultTheme.guid;

  const handleSetDefaultTheme = () => {
    if (!activeTheme) return;
    setBinding("public", effectiveKind, activeTheme.guid);
    toast.success(
      `Tema "${activeTheme.title}" definido como padrão para ${bindingLabel}!`,
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card/60 shadow-sm">
      {/* Barra de Ferramentas da Coluna 2 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Slides
          </span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-mono">
            {slides.length}
          </Badge>
        </div>

        {/* Controles de Visualização e Tema */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Botão de Alternar Prévia de Tema */}
          <Button
            variant={themePreviewActive ? "default" : "outline"}
            size="sm"
            onClick={() => setThemePreviewActive(!themePreviewActive)}
            className="h-7 text-xs gap-1.5"
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
          {themePreviewActive && themes.length > 0 && (
            <div className="flex items-center gap-1">
              <Select
                value={activeTheme?.guid ?? ""}
                onValueChange={(guid) => {
                  setSelectedThemeGuid(guid);
                  onThemeChange?.(guid);
                }}
              >
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue placeholder="Escolher tema..." />
                </SelectTrigger>
                <SelectContent align="end" className="w-[180px]">
                  {themes.map((theme) => (
                    <SelectItem
                      key={theme.guid}
                      value={theme.guid}
                      className="text-xs"
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

              <Button
                variant={isCurrentThemeDefault ? "secondary" : "outline"}
                size="sm"
                onClick={handleSetDefaultTheme}
                disabled={isCurrentThemeDefault || !activeTheme}
                className="h-7 px-2 text-xs gap-1"
                title={
                  isCurrentThemeDefault
                    ? "Este já é o tema padrão para letras"
                    : "Definir este tema como padrão para letras públicas"
                }
              >
                <Star
                  className={`size-3.5 ${
                    isCurrentThemeDefault
                      ? "text-amber-500 fill-amber-500"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="hidden xl:inline text-[11px]">
                  {isCurrentThemeDefault ? "Padrão" : "Tornar padrão"}
                </span>
              </Button>
            </div>
          )}

          {/* Controle de Zoom (+ e - para aumentar/diminuir o tamanho dos slides e fazer wrap dinâmico) */}
          {viewMode === "grid" && (
            <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-0.5 gap-0.5">
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
          <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-0.5">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="size-6 rounded-sm"
              title="Visualização em Grade"
            >
              <LayoutGrid className="size-3" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="size-6 rounded-sm"
              title="Visualização em Lista"
            >
              <List className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Área dos Slides */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {slides.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60 border border-border/40">
              <Sparkles className="size-6" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Nenhum slide gerado ainda
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {lyricsMode
                ? "Digite ou cole a letra na Coluna 1. Cada bloco separado por uma linha em branco gerará um slide nesta coluna."
                : "Digite ou cole os textos na Coluna 1. Cada bloco separado por uma linha em branco gerará um slide nesta coluna."}
            </p>
          </div>
        ) : (
          <div
            className={viewMode === "grid" ? "grid gap-3" : "flex flex-col gap-2.5"}
            style={
              viewMode === "grid"
                ? {
                    gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))`,
                  }
                : undefined
            }
          >
            {slides.map((item) => {
              const secColor = item.sectionType
                ? SECTION_COLOR[item.sectionType]
                : undefined;

              const slideProps = activeTheme
                ? {
                    ...buildProps(effectiveKind, item.slide),
                    title: songTitle || item.slide.title,
                    artist: songArtist,
                    artista: songArtist,
                  }
                : {};

              const card = (
                <div
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/70 bg-card/80 p-2.5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md ${
                    canEditLabels ? "cursor-context-menu" : ""
                  } ${viewMode === "list" ? "min-h-[72px]" : "min-h-[140px]"}`}
                >
                  {/* Cabeçalho do Card */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded bg-muted/80 text-[10px] font-mono font-bold text-muted-foreground tabular-nums">
                        {item.index + 1}
                      </span>

                      {canEditLabels ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 cursor-pointer outline-none rounded hover:opacity-80 transition-opacity"
                              title="Clique para alterar o rótulo da estrofe"
                            >
                              {item.label ? (
                                <Badge
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px] font-medium border flex items-center gap-1"
                                  style={
                                    secColor
                                      ? {
                                          borderColor: `${secColor}66`,
                                          backgroundColor: `${secColor}15`,
                                          color: secColor,
                                        }
                                      : undefined
                                  }
                                >
                                  <span>{item.label}</span>
                                  <ChevronDown className="size-2.5 opacity-60" />
                                </Badge>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded border border-dashed border-border/80 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                                  <Tag className="size-2.5" />
                                  <span>+ Rótulo</span>
                                  <ChevronDown className="size-2.5 opacity-60" />
                                </span>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52 z-50">
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Rótulo do Slide #{item.index + 1}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {SECTION_OPTIONS.map((sec) => {
                              const isSelected = item.sectionType === sec.type;
                              const dotColor = SECTION_COLOR[sec.type];
                              return (
                                <DropdownMenuItem
                                  key={sec.type}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetLabel(item.index, sec.type);
                                    toast.success(
                                      `Slide #${item.index + 1} marcado como "${sec.label}"`,
                                    );
                                  }}
                                  className="text-xs flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="size-2 rounded-full shrink-0"
                                      style={{ backgroundColor: dotColor }}
                                    />
                                    <span>{sec.label}</span>
                                  </div>
                                  {isSelected && (
                                    <Check className="size-3.5 text-primary" />
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                            {item.label && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetLabel(item.index, null);
                                    toast.info(
                                      `Rótulo do slide #${item.index + 1} removido`,
                                    );
                                  }}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Remover rótulo
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : item.label ? (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] font-medium border"
                          style={
                            secColor
                              ? {
                                  borderColor: `${secColor}66`,
                                  backgroundColor: `${secColor}15`,
                                  color: secColor,
                                }
                              : undefined
                          }
                        >
                          {item.label}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 italic">
                          Sem rótulo
                        </span>
                      )}
                    </div>

                    {canEditLabels && (
                      <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground flex items-center gap-0.5"
                        title="Clique no rótulo ou use o botão direito para alterar"
                      >
                        <Tag className="size-3" />
                        <span className="hidden sm:inline">Alterar rótulo</span>
                      </span>
                    )}
                  </div>

                  {/* Conteúdo do Slide */}
                  {themePreviewActive && activeTheme ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded border border-border/80 bg-black shadow-inner">
                      <ScaledStage
                        theme={activeTheme}
                        asset={effectiveAsset}
                        props={slideProps}
                        showBackground={true}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center py-1">
                      {item.slide.lines.length > 0 ? (
                        <div className="space-y-1">
                          {item.slide.lines.map((line, lIdx) => {
                            if (lyricsMode && isCommentLine(line)) {
                              return (
                                <div key={lIdx} className="my-0.5">
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold italic">
                                    📌 {cleanCommentText(line)}
                                  </span>
                                </div>
                              );
                            }
                            if (lyricsMode && isChordLine(line)) {
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
                                className="text-xs font-medium text-foreground/90 leading-tight truncate"
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

              if (!canEditLabels || onSetLabel === undefined) {
                return <div key={item.index}>{card}</div>;
              }

              return (
                <ContextMenu key={item.index} modal={false}>
                  <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>

                  {/* Menu de Contexto (Botão Direito) */}
                  <ContextMenuContent
                    className="w-52"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <ContextMenuLabel className="text-xs font-semibold text-muted-foreground">
                      Rótulo do Slide #{item.index + 1}
                    </ContextMenuLabel>
                    <ContextMenuSeparator />
                    {SECTION_OPTIONS.map((sec) => {
                      const isSelected = item.sectionType === sec.type;
                      const dotColor = SECTION_COLOR[sec.type];
                      return (
                        <ContextMenuItem
                          key={sec.type}
                          onClick={() => {
                            onSetLabel(item.index, sec.type);
                            toast.success(
                              `Slide #${item.index + 1} marcado como "${sec.label}"`,
                            );
                          }}
                          className="text-xs flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: dotColor }}
                            />
                            <span>{sec.label}</span>
                          </div>
                          {isSelected && <Check className="size-3.5 text-primary" />}
                        </ContextMenuItem>
                      );
                    })}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        onSetLabel(item.index, null);
                        toast.info(`Rótulo do slide #${item.index + 1} removido`);
                      }}
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Remover rótulo
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </div>

      {/* Dica no rodapé */}
      <div className="border-t border-border/70 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>
          {canEditLabels
            ? "Clique no rótulo (+ Rótulo) ou use o botão direito no slide para definir a seção"
            : lyricsMode
            ? "Slides gerados a partir da letra"
            : "Slides gerados a partir dos textos"}
        </span>
        {themePreviewActive && activeTheme && (
          <span className="truncate max-w-[200px]">
            Tema: <strong>{activeTheme.title}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
