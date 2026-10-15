import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SECTION_TYPES } from "@/core/config/lyrics";
import type { SectionType, Song, SongSection } from "@/core/types";
import { useSongsStore } from "./store";

export function SongEditorDialog() {
  const editorSong = useSongsStore((s) => s.editorSong);
  const closeEditor = useSongsStore((s) => s.closeEditor);
  const saveEditor = useSongsStore((s) => s.saveEditor);
  const deleteSong = useSongsStore((s) => s.deleteSong);

  const [draft, setDraft] = useState<Song | null>(editorSong);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(editorSong);
    setConfirmDelete(false);
    setActionError(null);
  }, [editorSong]);

  const updateDraft = (patch: Partial<Song>) =>
    setDraft((current) => (current === null ? current : { ...current, ...patch }));

  const updateSection = (index: number, patch: Partial<SongSection>) =>
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            sections: current.sections.map((section, i) =>
              i === index ? { ...section, ...patch } : section,
            ),
          },
    );

  const addSection = () =>
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            sections: [...current.sections, { sectionType: null, lines: [""] }],
          },
    );

  const removeSection = (index: number) =>
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            sections: current.sections.filter((_, i) => i !== index),
          },
    );

  const moveSection = (index: number, direction: -1 | 1) =>
    setDraft((current) => {
      if (current === null) return current;
      const target = index + direction;
      if (target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });

  const handleSave = async () => {
    if (draft === null || draft.title.trim() === "") return;
    setActionError(null);
    const ok = await saveEditor({
      ...draft,
      title: draft.title.trim(),
      artist: draft.artist.trim(),
      sections: draft.sections.map((section) => ({
        ...section,
        lines: section.lines
          .join("\n")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== ""),
      })),
    });
    if (!ok) {
      setActionError(
        useSongsStore.getState().error ?? "Não foi possível salvar.",
      );
    }
  };

  const handleDelete = async () => {
    if (draft === null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActionError(null);
    const ok = await deleteSong(draft.id);
    if (!ok) {
      setActionError(
        useSongsStore.getState().error ?? "Não foi possível excluir.",
      );
    }
  };

  return (
    <Dialog
      open={editorSong !== null}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      {draft && (
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {draft.title !== "" ? "Editar música" : "Nova música"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Título</span>
              <Input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Artista</span>
              <Input
                value={draft.artist}
                onChange={(e) => updateDraft({ artist: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
              {draft.sections.map((section, index) => (
                <Card key={index} className="gap-3 py-3">
                  <CardContent className="flex flex-col gap-2 px-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={section.sectionType ?? "none"}
                        onValueChange={(value) =>
                          updateSection(index, {
                            sectionType:
                              value === "none" ? null : (value as SectionType),
                          })
                        }
                      >
                        <SelectTrigger className="w-40" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="none">Sem rótulo</SelectItem>
                          {SECTION_TYPES.map((type) => (
                            <SelectItem key={type.type} value={type.type}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Mover bloco para cima"
                          disabled={index === 0}
                          onClick={() => moveSection(index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Mover bloco para baixo"
                          disabled={index === draft.sections.length - 1}
                          onClick={() => moveSection(index, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remover bloco"
                          onClick={() => removeSection(index)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={section.lines.join("\n")}
                      onChange={(e) =>
                        updateSection(index, { lines: e.target.value.split("\n") })
                      }
                      placeholder="Uma linha da letra por linha"
                      className="min-h-24"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button variant="outline" onClick={addSection}>
              ＋ bloco
            </Button>
          </div>
          {actionError !== null && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              className="sm:mr-auto"
              onClick={handleDelete}
            >
              {confirmDelete ? "Confirmar?" : "Excluir"}
            </Button>
            <Button variant="outline" onClick={closeEditor}>
              Cancelar
            </Button>
            <Button disabled={draft.title.trim() === ""} onClick={handleSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
