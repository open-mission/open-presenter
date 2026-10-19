import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Film,
  Image,
  Lock,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ThemeElementType } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/lib/utils";
import { useThemeEditorStore } from "./store";

const TYPE_ICONS: Record<ThemeElementType, LucideIcon> = {
  TEXT: Type,
  IMAGE: Image,
  VIDEO: Film,
  RECTANGLE: Square,
};

const TYPE_LABELS: Record<ThemeElementType, string> = {
  TEXT: "Texto",
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  RECTANGLE: "Retângulo",
};

interface LayersPanelProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function LayersPanel({ selectedId, onSelect }: LayersPanelProps) {
  const elements = useThemeEditorStore((s) => s.draft?.elements);
  const removeElement = useThemeEditorStore((s) => s.removeElement);
  const moveElement = useThemeEditorStore((s) => s.moveElement);
  const toggleVisible = useThemeEditorStore((s) => s.toggleVisible);
  const toggleLocked = useThemeEditorStore((s) => s.toggleLocked);
  const updateElement = useThemeEditorStore((s) => s.updateElement);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (!elements) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum tema carregado.
      </p>
    );
  }

  const ordered = [...elements].reverse();

  return (
    <div className="flex flex-col gap-1">
      <h4 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">
        CAMADAS
      </h4>
      {ordered.map((el) => {
        const index = elements.findIndex((e) => e.id === el.id);
        const isLast = elements.length <= 1;
        const isTop = index === elements.length - 1;
        const isBottom = index === 0;
        const selected = el.id === selectedId;
        const Icon = TYPE_ICONS[el.type];
        const label = el.name?.trim() || el.id;

        function commitRename() {
          updateElement(el.id, { name: editName.trim() || undefined });
          setEditingId(null);
        }

        return (
          <div
            key={el.id}
            role="button"
            tabIndex={0}
            aria-label={`Selecionar camada ${label}`}
            onClick={() => onSelect(el.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(el.id);
              }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1",
              selected
                ? "border-primary bg-accent"
                : "border-transparent hover:bg-accent/50",
              !el.visible && "opacity-50",
            )}
          >
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label={TYPE_LABELS[el.type]}
            />
            {editingId === el.id ? (
              <Input
                autoFocus
                value={editName}
                aria-label={`Renomear camada ${label}`}
                className="h-6 min-w-0 flex-1 px-1 text-xs"
                onChange={(event) => setEditName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRename();
                  } else if (event.key === "Escape") {
                    setEditingId(null);
                  }
                }}
              />
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-xs font-medium"
                title="Duplo clique para renomear"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditingId(el.id);
                  setEditName(label);
                }}
              >
                {label}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={el.visible ? `Ocultar ${label}` : `Mostrar ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleVisible(el.id);
              }}
            >
              {el.visible ? <Eye /> : <EyeOff />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={el.locked ? `Desbloquear ${label}` : `Bloquear ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleLocked(el.id);
              }}
            >
              <Lock className={cn(!el.locked && "opacity-30")} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Subir ${label}`}
              disabled={isTop}
              onClick={(e) => {
                e.stopPropagation();
                moveElement(el.id, 1);
              }}
            >
              <ChevronUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Descer ${label}`}
              disabled={isBottom}
              onClick={(e) => {
                e.stopPropagation();
                moveElement(el.id, -1);
              }}
            >
              <ChevronDown />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Excluir ${label}`}
              disabled={isLast}
              title={isLast ? "O tema precisa de ao menos um elemento" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                removeElement(el.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
