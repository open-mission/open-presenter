import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SlideTheme } from "@/core/types";
import { openThemeEditor } from "@/core/ipc/commands";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import {
  DEFAULT_MUSIC_THEME_GUID,
  DEFAULT_STAGE_REST_THEME_GUID,
  DEFAULT_STAGE_THEME_GUID,
  DEFAULT_TEXT_THEME_GUID,
} from "@/features/slide-themes/seedThemes";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useSetlistStore } from "./store";

const SYSTEM_GUIDS = new Set([
  DEFAULT_MUSIC_THEME_GUID,
  DEFAULT_TEXT_THEME_GUID,
  DEFAULT_STAGE_THEME_GUID,
  DEFAULT_STAGE_REST_THEME_GUID,
]);

interface StudioPickerDialogProps {
  partId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function StudioPickerDialog({
  partId,
  open,
  onOpenChange,
}: StudioPickerDialogProps) {
  const themes = useSlideThemesStore((s) => s.themes);
  const loadThemes = useSlideThemesStore((s) => s.load);
  const createPresentation = useSlideThemesStore((s) => s.createPresentation);
  const addMedia = useSetlistStore((s) => s.addMedia);
  const saveSetlist = useSetlistStore((s) => s.save);

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      void loadThemes();
    }
  }, [open, loadThemes]);

  const presentations = useMemo(() => {
    return themes.filter(
      (t) =>
        t.category === "presentation" ||
        (!SYSTEM_GUIDS.has(t.guid) && t.category !== "theme"),
    );
  }, [themes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presentations;
    return presentations.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.elements.some((el) => (el.text ?? "").toLowerCase().includes(q)),
    );
  }, [presentations, query]);

  async function handleSelect(theme: SlideTheme) {
    try {
      addMedia(partId, {
        kind: "text",
        title: theme.title,
        text: "",
        themeId: theme.guid,
      });
      await saveSetlist();
      toast.success(`Apresentação "${theme.title}" adicionada!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar.");
    }
  }

  async function handleCreateNew() {
    try {
      const created = await createPresentation("Nova Apresentação");
      addMedia(partId, {
        kind: "text",
        title: created.title,
        text: "",
        themeId: created.guid,
      });
      await saveSetlist();
      onOpenChange(false);
      toast.success(`Apresentação criada! Abrindo no Studio...`);
      await openThemeEditor(created.guid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar apresentação.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="size-4 text-amber-500" />
            Inserir Apresentação do Studio
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escolha uma apresentação salva da sua biblioteca ou crie uma nova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou texto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <ScrollArea className="h-72">
            <div className="flex flex-col gap-2 pr-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground gap-2">
                  <Sparkles className="size-8 opacity-40 text-amber-500" />
                  <p className="font-semibold text-foreground">
                    {query ? "Nenhuma apresentação encontrada" : "Nenhuma apresentação salva"}
                  </p>
                  <p className="max-w-[220px] text-[11px]">
                    {query
                      ? "Tente buscar por outro termo."
                      : "Crie uma nova apresentação para começar sua biblioteca."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 text-xs font-semibold gap-1.5"
                    onClick={() => void handleCreateNew()}
                  >
                    <Plus className="size-3.5" />
                    Criar Nova Apresentação
                  </Button>
                </div>
              ) : (
                filtered.map((theme) => (
                  <button
                    key={theme.guid}
                    type="button"
                    onClick={() => void handleSelect(theme)}
                    className="group flex items-center gap-3 p-2 rounded-xl border border-border/80 hover:border-amber-500/60 bg-card/60 hover:bg-accent/40 text-left transition-all cursor-pointer"
                  >
                    <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-black border border-border/80">
                      <ScaledStage
                        theme={theme}
                        asset="text"
                        props={{
                          title: theme.title,
                          titulo: theme.title,
                          lyrics: theme.title,
                          letra: theme.title,
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-amber-500 transition-colors">
                        {theme.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {theme.elements.length} {theme.elements.length === 1 ? "elemento" : "elementos"}
                        </Badge>
                      </div>
                    </div>
                    <Plus className="size-4 text-muted-foreground group-hover:text-amber-500 shrink-0 transition-colors" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs font-medium gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => void handleCreateNew()}
          >
            <Plus className="size-3.5" />
            Nova Apresentação
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
