import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Image as ImageIcon,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImageTreeNode } from "@/core/types";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import type { BackgroundAsset } from "../types";
import type { MediaLibraryKind } from "../useMediaFolderLibrary";

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: ImageTreeNode | null;
  items: ImageTreeNode[];
  onNavigate: (node: ImageTreeNode) => void;
  kind: MediaLibraryKind;
  targetOutputName?: string;
  onApplyAsset?: (asset: BackgroundAsset) => void;
  onPresentAsset?: (asset: BackgroundAsset) => void;
  onAddToSetlist?: (asset: BackgroundAsset) => void;
  onSetPreview?: (asset: BackgroundAsset) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(mins)}:${pad(secs)}`;
}

export function MediaPreviewDialog({
  open,
  onOpenChange,
  node,
  items,
  onNavigate,
  kind,
  targetOutputName,
  onApplyAsset,
  onPresentAsset,
  onAddToSetlist,
  onSetPreview,
}: MediaPreviewDialogProps) {
  const base = useMediaBaseUrl();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoop, setIsLoop] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const isVideo = kind === "videos" || (node?.name.toLowerCase().match(/\.(mp4|webm|mov|mkv|avi|m4v)$/) ?? false);
  const isAudio = kind === "audios" || (node?.name.toLowerCase().match(/\.(mp3|wav|m4a|aac|flac|ogg|wma)$/) ?? false);
  const isMediaPlayable = isVideo || isAudio;

  const currentIndex = node ? items.findIndex((item) => item.path === node.path) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  const resolvedSrc = node?.url ? resolveMediaLibraryUrl(node.url, base) : "";

  // Reset playback on node change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [node?.path]);

  // Keyboard navigation inside preview modal: ArrowLeft / ArrowRight / Space
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onNavigate(items[currentIndex - 1]!);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNavigate(items[currentIndex + 1]!);
      } else if (e.key === " " && isMediaPlayable) {
        e.preventDefault();
        const mediaElem = isVideo ? videoRef.current : audioRef.current;
        if (!mediaElem) return;
        if (mediaElem.paused) {
          void mediaElem.play().catch(() => {});
          setIsPlaying(true);
        } else {
          mediaElem.pause();
          setIsPlaying(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasPrev, hasNext, currentIndex, items, onNavigate, isMediaPlayable, isVideo]);

  if (!node) return null;

  const asset: BackgroundAsset = {
    id: `${isAudio ? "aud" : isVideo ? "vid" : "img"}:${node.path}`,
    name: node.name,
    kind: isAudio ? "audio" : isVideo ? "video" : "image",
    source: node.url ?? node.path,
    category: "public",
    tags: [node.path],
  };

  const togglePlay = () => {
    const mediaElem = isVideo ? videoRef.current : audioRef.current;
    if (!mediaElem) return;
    if (mediaElem.paused) {
      void mediaElem.play().catch(() => {});
      setIsPlaying(true);
    } else {
      mediaElem.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const mediaElem = isVideo ? videoRef.current : audioRef.current;
    if (mediaElem) {
      mediaElem.currentTime = time;
      setCurrentTime(time);
    }
  };

  const restartMedia = () => {
    const mediaElem = isVideo ? videoRef.current : audioRef.current;
    if (mediaElem) {
      mediaElem.currentTime = 0;
      setCurrentTime(0);
      void mediaElem.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur-md border-border shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/80 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {isAudio ? (
              <Music className="size-4 text-sky-400 shrink-0" />
            ) : isVideo ? (
              <Film className="size-4 text-amber-400 shrink-0" />
            ) : (
              <ImageIcon className="size-4 text-primary shrink-0" />
            )}
            <DialogTitle className="text-xs font-semibold truncate text-foreground">
              {node.name}
            </DialogTitle>
            {currentIndex >= 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                ({currentIndex + 1} de {items.length})
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline font-mono">
            Espaço para Play/Pausa · Setas para Navegar · Esc para Fechar
          </span>
        </DialogHeader>

        {/* Visualizador Principal */}
        <div className="relative aspect-video w-full bg-black/95 flex items-center justify-center overflow-hidden">
          {isVideo ? (
            <video
              ref={videoRef}
              src={resolvedSrc}
              muted={isMuted}
              loop={isLoop}
              playsInline
              preload="auto"
              className="size-full object-contain"
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                e.currentTarget.currentTime = 0.001;
              }}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
              }}
              onEnded={() => {
                if (!isLoop) setIsPlaying(false);
              }}
              onClick={togglePlay}
            />
          ) : isAudio ? (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <audio
                ref={audioRef}
                src={resolvedSrc}
                loop={isLoop}
                muted={isMuted}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => {
                  if (!isLoop) setIsPlaying(false);
                }}
              />
              <div
                onClick={togglePlay}
                className="size-24 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg group"
              >
                {isPlaying ? (
                  <Pause className="size-10 text-primary fill-primary" />
                ) : (
                  <Play className="size-10 text-primary fill-primary ml-1" />
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-semibold text-sm text-foreground max-w-md truncate">
                  {node.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Arquivo de Áudio · {formatTime(duration)}
                </span>
              </div>
            </div>
          ) : (
            <img
              src={resolvedSrc}
              alt={node.name}
              className="size-full object-contain select-none"
            />
          )}

          {/* Navegação: Botão Anterior */}
          {hasPrev && (
            <button
              type="button"
              onClick={() => onNavigate(items[currentIndex - 1]!)}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 text-white/80 hover:bg-black/90 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
              title="Arquivo anterior (Seta para a esquerda)"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          {/* Navegação: Botão Próximo */}
          {hasNext && (
            <button
              type="button"
              onClick={() => onNavigate(items[currentIndex + 1]!)}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 text-white/80 hover:bg-black/90 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
              title="Próximo arquivo (Seta para a direita)"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        {/* Controles de Mídia (Vídeo / Áudio) */}
        {isMediaPlayable && (
          <div className="flex items-center gap-2.5 px-4 py-2 border-t border-border/60 bg-muted/20">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={togglePlay}
              className="size-7 cursor-pointer text-foreground hover:bg-primary/20 hover:text-primary"
              title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
            >
              {isPlaying ? (
                <Pause className="size-3.5 fill-current" />
              ) : (
                <Play className="size-3.5 fill-current" />
              )}
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={restartMedia}
              className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
              title="Voltar ao início"
            >
              <RotateCcw className="size-3.5" />
            </Button>

            <span className="font-mono text-[10px] text-muted-foreground tabular-nums select-none min-w-[35px]">
              {formatTime(currentTime)}
            </span>

            {/* Timeline Scrubber */}
            <div className="relative flex flex-1 items-center">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-muted/60 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                style={{
                  background: `linear-gradient(to right, var(--color-primary, #6366f1) ${progressPercent}%, rgba(120, 120, 120, 0.25) ${progressPercent}%)`,
                }}
              />
            </div>

            <span className="font-mono text-[10px] text-muted-foreground tabular-nums select-none min-w-[35px]">
              {formatTime(duration)}
            </span>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsLoop(!isLoop)}
              className={`size-7 cursor-pointer transition-colors ${
                isLoop
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={isLoop ? "Repetição ativada" : "Repetição desativada"}
            >
              <Repeat className="size-3.5" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsMuted(!isMuted)}
              className={`size-7 cursor-pointer transition-colors ${
                isMuted
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-primary hover:bg-primary/20"
              }`}
              title={isMuted ? "Áudio mutado" : "Áudio ativo"}
            >
              {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </Button>
          </div>
        )}

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 bg-card/60">
          <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
            {node.path}
          </div>

          <div className="flex items-center gap-1.5">
            {onSetPreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onSetPreview(asset);
                }}
                className="h-7 gap-1 px-2.5 text-xs cursor-pointer"
                title="Colocar no monitor de Prévia em cima"
              >
                <Eye className="size-3" />
                <span>Colocar no Preview</span>
              </Button>
            )}

            {onApplyAsset && !isAudio && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  onApplyAsset(asset);
                }}
                className="h-7 gap-1 px-2.5 text-xs cursor-pointer font-medium"
                title={
                  targetOutputName
                    ? `Aplicar como fundo em ${targetOutputName}`
                    : "Aplicar como fundo"
                }
              >
                <span>Aplicar Fundo</span>
              </Button>
            )}

            {onPresentAsset && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onPresentAsset(asset);
                }}
                className="h-7 gap-1 px-2.5 text-xs cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                title="Projetar ou reproduzir ao vivo imediatamente"
              >
                <Radio className="size-3" />
                <span>Ao Vivo</span>
              </Button>
            )}

            {onAddToSetlist && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onAddToSetlist(asset);
                }}
                className="h-7 gap-1 px-2.5 text-xs cursor-pointer"
                title="Adicionar à programação do culto"
              >
                <Plus className="size-3" />
                <span>Programação</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

