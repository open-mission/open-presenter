import { useState } from "react";
import {
  LayoutTemplate,
  Plus,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openThemeEditor } from "@/core/ipc/commands";
import { useSlideThemesStore } from "@/features/slide-themes/store";

const STUDIO_PRESETS = [
  {
    id: "dark",
    name: "Minimalista Escuro",
    description: "Fundo escuro clean para ministração e anúncios",
    gradient: "#09090b",
  },
  {
    id: "indigo",
    name: "Noite & Índigo",
    description: "Gradiente profundo azul noite",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
  },
  {
    id: "amber",
    name: "Ouro & Âmbar",
    description: "Cores quentes e acolhedoras",
    gradient: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #1c1917 100%)",
  },
  {
    id: "emerald",
    name: "Esmeralda",
    description: "Tom solene de verde escuro",
    gradient: "linear-gradient(135deg, #064e3b 0%, #022c22 60%, #000000 100%)",
  },
  {
    id: "rose",
    name: "Carmim & Vinho",
    description: "Gradiente sofisticado para cultos especiais",
    gradient: "linear-gradient(135deg, #4c0519 0%, #881337 50%, #0f172a 100%)",
  },
];

export function MediaStudioBrowser() {
  const createPresentation = useSlideThemesStore((s) => s.createPresentation);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateWithPreset = async (title: string, gradient: string) => {
    try {
      setCreating(true);
      const name = title.trim() || "Nova Apresentação";
      const created = await createPresentation(name, gradient);
      toast.success(`Apresentação "${created.title}" criada! Abrindo editor...`);
      setNewTitle("");
      void openThemeEditor(created.guid);
    } catch {
      toast.error("Falha ao criar apresentação no Studio.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Quick Creator Box */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-3">
        <span className="text-[11px] font-semibold text-foreground">
          Criar Apresentação Rápida
        </span>
        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nome da apresentação (ex: Boas-Vindas, Avisos Domingo)…"
            className="h-8 text-xs bg-muted/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                void handleCreateWithPreset(newTitle, STUDIO_PRESETS[0].gradient);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={creating}
            onClick={() => void handleCreateWithPreset(newTitle, STUDIO_PRESETS[0].gradient)}
            className="h-8 gap-1 px-3 text-xs font-semibold shrink-0 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Criar & Editar</span>
          </Button>
        </div>
      </div>

      {/* Preset Templates */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">
            Modelos de Início Rápido
          </span>
        </div>

        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
          {STUDIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={creating}
              onClick={() => void handleCreateWithPreset(preset.name, preset.gradient)}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card/60 text-left transition-all hover:border-primary/50 hover:shadow-xs cursor-pointer select-none"
            >
              <div
                className="aspect-video w-full p-2 flex items-end justify-start transition-transform group-hover:scale-[1.02]"
                style={{ background: preset.gradient }}
              >
                <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                  {preset.name}
                </span>
              </div>
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                  <Wand2 className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  {preset.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
