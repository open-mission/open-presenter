import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSongDefaults, setSongDefaults } from "@/core/ipc/commands";
import type { LinesPerSlide } from "@/core/types";
import { useSongsStore } from "@/features/songs/store";
import { useSongGroupsStore } from "@/features/songs/songGroupsStore";

const PRESET_SWATCHES = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#a855f7",
  "#10b981",
  "#f43f5e",
  "#9ca3af",
  "#4b5563",
  "#1e293b",
  "#0f172a",
];

const LINES_PER_SLIDE_OPTIONS: { value: LinesPerSlide; label: string }[] = [
  { value: "1", label: "1 linha por slide" },
  { value: "2", label: "2 linhas por slide" },
  { value: "keep", label: "Estrofe inteira" },
];

export function SongsTab() {
  const startHolyricsImport = useSongsStore((s) => s.startHolyricsImport);
  const loading = useSongsStore((s) => s.loading);
  const groups = useSongGroupsStore((s) => s.groups);
  const updateGroup = useSongGroupsStore((s) => s.updateGroup);
  const addGroup = useSongGroupsStore((s) => s.addGroup);
  const removeGroup = useSongGroupsStore((s) => s.removeGroup);
  const moveGroup = useSongGroupsStore((s) => s.moveGroup);
  const setShortcut = useSongGroupsStore((s) => s.setShortcut);
  const clearShortcut = useSongGroupsStore((s) => s.clearShortcut);
  const resetDefaults = useSongGroupsStore((s) => s.resetDefaults);

  const [recordingGroupId, setRecordingGroupId] = useState<string | null>(null);
  const [linesPerSlide, setLinesPerSlide] = useState<LinesPerSlide | null>(null);

  // Load persisted lines-per-slide preference
  useEffect(() => {
    let cancelled = false;
    void getSongDefaults()
      .then((defaults) => {
        if (!cancelled) setLinesPerSlide(defaults.linesPerSlide);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLinesPerSlideChange(value: LinesPerSlide) {
    try {
      const saved = await setSongDefaults({ linesPerSlide: value });
      setLinesPerSlide(saved.linesPerSlide);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  // Listen for keypress when recording a shortcut
  useEffect(() => {
    if (!recordingGroupId) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingGroupId(null);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        clearShortcut(recordingGroupId!);
        setRecordingGroupId(null);
        return;
      }

      // We only allow single character keys (letters, digits)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShortcut(recordingGroupId!, e.key.toUpperCase());
        setRecordingGroupId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingGroupId, setShortcut, clearShortcut]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Músicas & Grupos
        </h3>
        <p className="text-sm text-muted-foreground">
          Importe letras de projeção e configure os rótulos de estrofes (versos,
          refrão, ponte) e seus atalhos de teclado.
        </p>
      </div>

      {/* Section: Importação de Músicas */}
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Importar de outro software de projeção
          </h4>
          <p className="text-xs text-muted-foreground">
            Importe sua biblioteca de músicas de outro software de projeção (.json
            ou .txt). Selecione um ou vários arquivos. Músicas já existentes
            (mesmo título e artista) são ignoradas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void startHolyricsImport()}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-border/80 bg-card/40 px-4 text-xs font-medium text-foreground transition-all hover:border-primary/60 hover:bg-muted/40 cursor-pointer shadow-2xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <FolderOpen className="size-4 text-primary" />
          )}
          <span>{loading ? "Importando músicas…" : "Importar músicas (.json, .txt)"}</span>
        </button>
      </div>

      {/* Section: Linhas por Slide */}
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Linhas por slide
          </h4>
          <p className="text-xs text-muted-foreground">
            Padrão ao importar músicas e ao salvar letras da internet.
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-card/60 p-2 shadow-2xs">
          {LINES_PER_SLIDE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                linesPerSlide === option.value
                  ? "bg-primary/5 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="song-lines-per-slide"
                value={option.value}
                checked={linesPerSlide === option.value}
                onChange={() => void handleLinesPerSlideChange(option.value)}
                className="accent-primary"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Section: Grupos de Música */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Grupos de música
            </h4>
            <p className="text-xs text-muted-foreground">
              Grupos padrão do sistema (nome e cor) para organizar os versos das
              músicas. Ficam disponíveis no editor de letras e são aplicados na
              importação.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetDefaults}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title="Restaurar grupos padrão originais"
          >
            <RotateCcw className="size-3" />
            <span>Padrões</span>
          </Button>
        </div>

        {/* Group Items List */}
        <div className="flex flex-col gap-2">
          {groups.map((group, index) => {
            const isRecording = recordingGroupId === group.id;

            return (
              <div
                key={group.id}
                className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/60 p-2 shadow-2xs transition-colors hover:border-border"
              >
                {/* Color Swatch with Popover Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="size-7 shrink-0 rounded-lg border border-black/20 dark:border-white/20 transition-transform hover:scale-105 cursor-pointer shadow-2xs"
                      style={{ backgroundColor: group.color }}
                      title="Alterar cor do grupo"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="start"
                    className="w-64 p-3 shadow-lg"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-semibold text-foreground">
                          Cor do grupo
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={group.color}
                            onChange={(e) =>
                              updateGroup(group.id, { color: e.target.value })
                            }
                            className="size-5 rounded border border-border bg-transparent p-0 cursor-pointer"
                          />
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {group.color}
                          </span>
                        </div>
                      </div>

                      {/* Swatches Grid */}
                      <div className="grid grid-cols-8 gap-1.5">
                        {PRESET_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateGroup(group.id, { color: hex })}
                            className={`size-6 rounded-md border transition-transform hover:scale-110 cursor-pointer ${
                              group.color.toLowerCase() === hex.toLowerCase()
                                ? "ring-2 ring-primary ring-offset-1"
                                : "border-black/10 dark:border-white/10"
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Name Input */}
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) =>
                    updateGroup(group.id, { name: e.target.value })
                  }
                  placeholder="Nome do grupo..."
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                />

                {/* Shortcut Key Button */}
                <button
                  type="button"
                  onClick={() =>
                    setRecordingGroupId(isRecording ? null : group.id)
                  }
                  className={`h-8 min-w-12 rounded-md border px-2.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                    isRecording
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/40 animate-pulse"
                      : group.shortcut
                        ? "border-border/80 bg-muted/60 text-foreground hover:bg-muted"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                  }`}
                  title={
                    isRecording
                      ? "Pressione uma tecla para definir o atalho (ou Esc para cancelar)"
                      : "Clique para definir um atalho de teclado"
                  }
                >
                  {isRecording ? "tecla…" : group.shortcut || "atalho"}
                </button>

                {/* Clear Shortcut Button */}
                <button
                  type="button"
                  onClick={() => clearShortcut(group.id)}
                  disabled={!group.shortcut}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                  title="Limpar atalho"
                >
                  <X className="size-3.5" />
                </button>

                {/* Move Up Button */}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveGroup(group.id, -1)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                  title="Mover para cima"
                >
                  <ChevronUp className="size-3.5" />
                </button>

                {/* Move Down Button */}
                <button
                  type="button"
                  disabled={index === groups.length - 1}
                  onClick={() => moveGroup(group.id, 1)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                  title="Mover para baixo"
                >
                  <ChevronDown className="size-3.5" />
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                  title="Excluir grupo"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Group Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addGroup()}
          className="h-8 w-fit gap-1.5 text-xs font-medium cursor-pointer"
        >
          <Plus className="size-3.5 text-primary" />
          <span>Adicionar grupo</span>
        </Button>
      </div>
    </div>
  );
}
