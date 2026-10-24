import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Film,
  Music,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import { useMediaPlaybackStore } from "@/core/store/mediaPlaybackStore";
import { usePresentationStore } from "@/features/presentation/store";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(mins)}:${pad(secs)}`;
}

export function HeaderMediaControls() {
  const active = useMediaPlaybackStore((s) => s.active);
  const title = useMediaPlaybackStore((s) => s.title);
  const kind = useMediaPlaybackStore((s) => s.kind);
  const isPlaying = useMediaPlaybackStore((s) => s.isPlaying);
  const currentTime = useMediaPlaybackStore((s) => s.currentTime);
  const duration = useMediaPlaybackStore((s) => s.duration);
  const isLoop = useMediaPlaybackStore((s) => s.isLoop);
  const isMuted = useMediaPlaybackStore((s) => s.isMuted);

  const togglePlay = useMediaPlaybackStore((s) => s.togglePlay);
  const restart = useMediaPlaybackStore((s) => s.restart);
  const stop = useMediaPlaybackStore((s) => s.stop);
  const seek = useMediaPlaybackStore((s) => s.seek);
  const toggleLoop = useMediaPlaybackStore((s) => s.toggleLoop);
  const toggleMute = useMediaPlaybackStore((s) => s.toggleMute);

  const liveBg = usePresentationStore((s) => s.live.background);
  const liveMedia = usePresentationStore((s) => s.live.content.media);

  // Auto-detect if live background is video or live slide has media
  useEffect(() => {
    if (liveBg.kind === "video" && liveBg.value) {
      const parts = liveBg.value.split(/[/\\]/);
      const filename = decodeURIComponent(parts[parts.length - 1] || "Vídeo de Fundo");
      useMediaPlaybackStore.getState().setMedia({
        source: liveBg.value,
        title: filename,
        kind: "video",
      });
    } else if (liveMedia && (liveMedia.kind === "video" || (liveMedia.kind as string) === "audio")) {
      useMediaPlaybackStore.getState().setMedia({
        source: liveMedia.path ?? "",
        title: liveMedia.title || "Mídia Ao Vivo",
        kind: (liveMedia.kind as string) === "audio" ? "audio" : "video",
      });
    }
  }, [liveBg, liveMedia]);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const progressPercent =
    duration > 0
      ? Math.min(100, Math.max(0, ((isScrubbing ? scrubValue : currentTime) / duration) * 100))
      : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setScrubValue(val);
    seek(val);
  };

  const handleMouseDown = () => {
    setIsScrubbing(true);
    setScrubValue(currentTime);
  };

  const handleMouseUp = () => {
    setIsScrubbing(false);
  };

  const handleRemoveFromScreen = async () => {
    stop();
    useMediaPlaybackStore.getState().setMedia(null);

    const liveBg = usePresentationStore.getState().live.background;
    if (liveBg.kind === "video" || liveBg.kind === "image") {
      await usePresentationStore.getState().setBackground({
        id: "bg-default",
        kind: "color",
        value: "#000000",
      });
    }

    const liveContent = usePresentationStore.getState().live.content;
    if (liveContent.kind === "media") {
      await usePresentationStore.getState().clearLive();
    }

    toast.success("Mídia removida da tela e da reprodução.");
  };

  if (!active && liveBg.kind !== "video" && liveMedia?.kind !== "video") {
    return null;
  }

  const Icon = kind === "audio" ? Music : Film;
  const displayTime = isScrubbing ? scrubValue : currentTime;

  return (
    <div
      role="region"
      aria-label="Controle de reprodução de mídia ao vivo"
      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs shadow-2xs animate-in fade-in duration-200"
    >
      {/* Ícone e Título da Mídia */}
      <div className="flex items-center gap-1.5 max-w-[130px] md:max-w-[170px] min-w-0">
        <Icon className="size-3.5 text-primary shrink-0 animate-pulse" />
        <span
          className="truncate text-[11px] font-semibold text-foreground"
          title={title ?? "Mídia em reprodução"}
        >
          {title ?? "Fundo de Vídeo"}
        </span>
      </div>

      <div className="h-4 w-px bg-border/80" />

      {/* Botões Play/Pause e Reiniciar */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          className="size-6 text-foreground hover:bg-primary/20 hover:text-primary cursor-pointer"
          title={isPlaying ? "Pausar vídeo/áudio" : "Reproduzir vídeo/áudio"}
        >
          {isPlaying ? (
            <Pause className="size-3 fill-current" />
          ) : (
            <Play className="size-3 fill-current" />
          )}
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={restart}
          className="size-6 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          title="Reiniciar mídia do início (00:00)"
        >
          <RotateCcw className="size-3" />
        </Button>
      </div>

      {/* Timeline / Scrubber */}
      <div className="flex items-center gap-1.5 min-w-[120px] md:min-w-[160px]">
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums select-none">
          {formatTime(displayTime)}
        </span>

        <div className="relative flex flex-1 items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={isScrubbing ? scrubValue : currentTime}
            onChange={handleSliderChange}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            style={{
              background: `linear-gradient(to right, var(--color-primary, #6366f1) ${progressPercent}%, rgba(120, 120, 120, 0.25) ${progressPercent}%)`,
            }}
            title="Avançar / retroceder no vídeo"
          />
        </div>

        <span className="font-mono text-[10px] text-muted-foreground tabular-nums select-none">
          {formatTime(duration)}
        </span>
      </div>

      <div className="h-4 w-px bg-border/80" />

      {/* Opções: Loop e Mudo */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleLoop}
          className={cn(
            "size-6 cursor-pointer transition-colors",
            isLoop
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          title={isLoop ? "Repetição contínua ativa" : "Repetição desativada"}
        >
          <Repeat className="size-3" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className={cn(
            "size-6 cursor-pointer transition-colors",
            isMuted
              ? "text-muted-foreground hover:bg-accent hover:text-foreground"
              : "text-primary hover:bg-primary/20",
          )}
          title={isMuted ? "Áudio desativado (Mudo)" : "Áudio ativado"}
        >
          {isMuted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={stop}
          className="size-6 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          title="Parar e voltar ao início (00:00)"
        >
          <Square className="size-2.5" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => void handleRemoveFromScreen()}
          className="size-6 text-destructive/80 hover:bg-destructive/15 hover:text-destructive cursor-pointer"
          title="Remover mídia ativa da tela e da reprodução"
        >
          <XCircle className="size-3" />
        </Button>
      </div>
    </div>
  );
}
