import { useState } from "react";
import {
  Activity,
  AlignLeft,
  Disc3,
  KeyRound,
  Mic2,
  Music,
  PenTool,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Song } from "@/core/types";
import { MUSICAL_KEYS } from "./songEditorUtils";

export type EditorSongDraft = Pick<
  Song,
  "id" | "title" | "artist" | "album" | "composer" | "songKey" | "bpm"
>;

interface SongMetadataHeaderProps {
  draft: EditorSongDraft;
  isNew: boolean;
  canSave: boolean;
  confirmDelete: boolean;
  onUpdateDraft: (patch: Partial<EditorSongDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  mode?: "song" | "text";
}

export function SongMetadataHeader({
  draft,
  isNew,
  canSave,
  confirmDelete,
  onUpdateDraft,
  onSave,
  onCancel,
  onDelete,
  mode = "song",
}: SongMetadataHeaderProps) {
  const isTextMode = mode === "text";
  const [bpmInput, setBpmInput] = useState<string>(
    draft.bpm !== undefined && draft.bpm !== null ? String(draft.bpm) : "",
  );

  const handleBpmChange = (raw: string) => {
    setBpmInput(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0 && num <= 300) {
      onUpdateDraft({ bpm: num });
    } else if (raw.trim() === "") {
      onUpdateDraft({ bpm: undefined });
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border/80 bg-muted/20 px-6 py-4">
      {/* Linha Superior: Título do Diálogo e Ações */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            {isTextMode ? (
              <AlignLeft className="size-5" />
            ) : (
              <Music className="size-5" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
              {isTextMode
                ? isNew
                  ? "Novo Texto"
                  : "Editar Texto"
                : isNew
                ? "Cadastrar Nova Música"
                : "Editar Música"}
              {draft.title && (
                <span className="text-xs font-normal text-muted-foreground truncate max-w-xs">
                  — {draft.title}
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isTextMode
                ? "Edite os textos e visualize os slides em tempo real"
                : "Edite metadados, letra e visualize os slides em tempo real"}
            </p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              size="sm"
              onClick={onDelete}
              className="h-8 gap-1.5 text-xs font-medium"
              title={isTextMode ? "Excluir este texto" : "Excluir esta música"}
            >
              <Trash2 className="size-3.5" />
              <span>{confirmDelete ? "Confirmar Exclusão?" : "Excluir"}</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 gap-1.5 text-xs text-muted-foreground"
          >
            <X className="size-3.5" />
            <span>Cancelar</span>
          </Button>

          <Button
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            className="h-8 gap-1.5 text-xs font-medium shadow-sm"
          >
            <Save className="size-3.5" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      {/* Grid de Metadados: Nome (e dados de música quando aplicável) */}
      <div
        className={
          isTextMode
            ? "grid grid-cols-1 gap-2.5 pt-1"
            : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1"
        }
      >
        {/* Nome / Título */}
        <label className={`flex flex-col gap-1 ${isTextMode ? "max-w-md" : ""}`}>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {isTextMode ? (
              <AlignLeft className="size-3 text-primary/70" />
            ) : (
              <Music className="size-3 text-primary/70" />
            )}
            {isTextMode ? "Nome do texto" : "Nome"}
          </span>
          <Input
            value={draft.title}
            onChange={(e) => onUpdateDraft({ title: e.target.value })}
            placeholder={isTextMode ? "Ex.: Avisos do Culto" : "Ex.: Ousado Amor"}
            className="h-8 text-xs font-medium bg-background"
          />
        </label>

        {!isTextMode && (
          <>
            {/* Cantor / Artista */}
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Mic2 className="size-3 text-indigo-400" />
                Cantor / Artista
              </span>
              <Input
                value={draft.artist}
                onChange={(e) => onUpdateDraft({ artist: e.target.value })}
                placeholder="Ex.: Isaias Saad"
                className="h-8 text-xs bg-background"
              />
            </label>

            {/* Álbum */}
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Disc3 className="size-3 text-cyan-400" />
                Álbum
              </span>
              <Input
                value={draft.album ?? ""}
                onChange={(e) => onUpdateDraft({ album: e.target.value })}
                placeholder="Ex.: Ao Vivo em SP"
                className="h-8 text-xs bg-background"
              />
            </label>

            {/* Compositor */}
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <PenTool className="size-3 text-amber-400" />
                Compositor
              </span>
              <Input
                value={draft.composer ?? ""}
                onChange={(e) => onUpdateDraft({ composer: e.target.value })}
                placeholder="Ex.: Cory Asbury..."
                className="h-8 text-xs bg-background"
              />
            </label>

            {/* Tom (Key) */}
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <KeyRound className="size-3 text-rose-400" />
                Tom
              </span>
              <div className="flex items-center gap-1">
                <Select
                  value={draft.songKey ?? ""}
                  onValueChange={(val) => onUpdateDraft({ songKey: val })}
                >
                  <SelectTrigger className="h-8 text-xs bg-background font-mono">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {MUSICAL_KEYS.map((k) => (
                      <SelectItem key={k} value={k} className="text-xs font-mono">
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.songKey && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => onUpdateDraft({ songKey: "" })}
                    title="Limpar Tom"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </label>

            {/* BPM */}
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Activity className="size-3 text-emerald-400" />
                BPM
              </span>
              <Input
                type="number"
                min={30}
                max={300}
                value={bpmInput}
                onChange={(e) => handleBpmChange(e.target.value)}
                placeholder="Ex.: 72"
                className="h-8 text-xs font-mono bg-background"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
