import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Film,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Image,
  Lock,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ThemeElement, ThemeElementType } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/lib/utils";
import { getActivePage } from "@/features/slide-themes/pages";
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

interface GroupItem {
  type: "group";
  groupId: string;
  name: string;
  elements: ThemeElement[];
}

interface SingleItem {
  type: "single";
  element: ThemeElement;
}

type LayerItem = GroupItem | SingleItem;

export function LayersPanel({ selectedId, onSelect }: LayersPanelProps) {
  const draft = useThemeEditorStore((s) => s.draft);
  const activePageId = useThemeEditorStore((s) => s.activePageId);
  const page = getActivePage(draft, activePageId);
  const elements = page?.elements ?? draft?.elements;
  const pageMode = Boolean(draft?.pages?.length);

  const removeElement = useThemeEditorStore((s) => s.removeElement);
  const moveElement = useThemeEditorStore((s) => s.moveElement);
  const toggleVisible = useThemeEditorStore((s) => s.toggleVisible);
  const toggleLocked = useThemeEditorStore((s) => s.toggleLocked);
  const updateElement = useThemeEditorStore((s) => s.updateElement);

  const groupElements = useThemeEditorStore((s) => s.groupElements);
  const ungroupElements = useThemeEditorStore((s) => s.ungroupElements);
  const renameGroup = useThemeEditorStore((s) => s.renameGroup);
  const toggleGroupVisible = useThemeEditorStore((s) => s.toggleGroupVisible);
  const toggleGroupLocked = useThemeEditorStore((s) => s.toggleGroupLocked);
  const moveGroup = useThemeEditorStore((s) => s.moveGroup);
  const removeGroup = useThemeEditorStore((s) => s.removeGroup);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const ordered = useMemo(() => {
    return elements ? [...elements].reverse() : [];
  }, [elements]);

  const items = useMemo<LayerItem[]>(() => {
    const list: LayerItem[] = [];
    const seenGroups = new Set<string>();

    for (const el of ordered) {
      if (el.groupId) {
        if (seenGroups.has(el.groupId)) continue;
        seenGroups.add(el.groupId);
        const groupElements = ordered.filter((e) => e.groupId === el.groupId);
        list.push({
          type: "group",
          groupId: el.groupId,
          name: el.groupName || "Grupo",
          elements: groupElements,
        });
      } else {
        list.push({
          type: "single",
          element: el,
        });
      }
    }
    return list;
  }, [ordered]);

  if (!elements) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum tema carregado.
      </p>
    );
  }

  // Verificar se há seleção múltipla para agrupar
  const canGroup = selectedIds.size >= 2;
  // Verificar se há seleção de grupo ou item agrupado para desagrupar
  const selectedElements = elements.filter((e) => selectedIds.has(e.id) || e.id === selectedId);
  const selectedGroupId = selectedElements.find((e) => e.groupId)?.groupId;
  const canUngroup = Boolean(selectedGroupId);

  function handleSelectElement(elId: string, event: React.MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (selectedId && !next.has(selectedId)) next.add(selectedId);
        if (next.has(elId)) {
          next.delete(elId);
        } else {
          next.add(elId);
        }
        return next;
      });
      onSelect(elId);
    } else {
      setSelectedIds(new Set([elId]));
      onSelect(elId);
    }
  }

  function handleGroupSelected() {
    if (selectedIds.size < 2) return;
    const newGroupId = groupElements(Array.from(selectedIds));
    if (newGroupId) {
      const firstId = Array.from(selectedIds)[0];
      onSelect(firstId);
    }
  }

  function handleUngroupSelected() {
    if (selectedGroupId) {
      ungroupElements(selectedGroupId);
    }
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1.5 select-none">
      {/* Top Header Bar with Group Actions */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground">
          CAMADAS
        </h4>
        <div className="flex items-center gap-1">
          {canGroup && (
            <Button
              variant="outline"
              size="xs"
              className="h-6 gap-1 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
              title="Agrupar camadas selecionadas"
              onClick={handleGroupSelected}
            >
              <FolderPlus className="size-3" />
              <span>Agrupar ({selectedIds.size})</span>
            </Button>
          )}
          {canUngroup && (
            <Button
              variant="ghost"
              size="xs"
              className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              title="Desagrupar elementos do grupo"
              onClick={handleUngroupSelected}
            >
              <FolderMinus className="size-3" />
              <span>Desagrupar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Layer Items List */}
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          if (item.type === "group") {
            const isCollapsed = collapsedGroups.has(item.groupId);
            const allVisible = item.elements.every((e) => e.visible);
            const allLocked = item.elements.every((e) => e.locked);
            const isGroupSelected = item.elements.some((e) => e.id === selectedId || selectedIds.has(e.id));

            const targetGroupId = item.groupId;
            function commitGroupRename() {
              renameGroup(targetGroupId, editGroupName.trim() || "Grupo");
              setEditingGroupId(null);
            }

            return (
              <div
                key={item.groupId}
                className={cn(
                  "flex flex-col rounded-lg border transition-all",
                  isGroupSelected
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 bg-muted/15",
                )}
              >
                {/* Group Header Row */}
                <div
                  className="flex items-center gap-1 px-1.5 py-1 text-xs cursor-pointer hover:bg-accent/40 rounded-t-lg"
                  onClick={() => {
                    const ids = item.elements.map((e) => e.id);
                    setSelectedIds(new Set(ids));
                    onSelect(ids[0]);
                  }}
                >
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Expandir grupo" : "Recolher grupo"}
                    className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupCollapse(item.groupId);
                    }}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>

                  {isCollapsed ? (
                    <Folder className="size-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <FolderOpen className="size-3.5 text-amber-500 shrink-0" />
                  )}

                  {editingGroupId === item.groupId ? (
                    <Input
                      autoFocus
                      value={editGroupName}
                      aria-label={`Renomear grupo ${item.name}`}
                      className="h-6 min-w-0 flex-1 px-1 text-xs font-semibold"
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={commitGroupRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitGroupRename();
                        } else if (e.key === "Escape") {
                          setEditingGroupId(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="min-w-0 flex-1 truncate font-semibold text-xs text-foreground"
                      title="Duplo clique para renomear grupo"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingGroupId(item.groupId);
                        setEditGroupName(item.name);
                      }}
                    >
                      {item.name}
                    </span>
                  )}

                  <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 pr-0.5">
                    {item.elements.length}
                  </span>

                  {/* Group Action Buttons */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={allVisible ? "Ocultar grupo" : "Mostrar grupo"}
                    title={allVisible ? "Ocultar grupo" : "Mostrar grupo"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupVisible(item.groupId);
                    }}
                  >
                    {allVisible ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={allLocked ? "Desbloquear grupo" : "Bloquear grupo"}
                    title={allLocked ? "Desbloquear grupo" : "Bloquear grupo"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupLocked(item.groupId);
                    }}
                  >
                    <Lock className={cn(!allLocked && "opacity-30")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Subir grupo"
                    title="Subir grupo na pilha"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveGroup(item.groupId, 1);
                    }}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Descer grupo"
                    title="Descer grupo na pilha"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveGroup(item.groupId, -1);
                    }}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Desagrupar"
                    title="Desagrupar elementos"
                    onClick={(e) => {
                      e.stopPropagation();
                      ungroupElements(item.groupId);
                    }}
                  >
                    <FolderMinus className="size-3 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Excluir grupo"
                    title="Excluir grupo e elementos"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(item.groupId);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>

                {/* Group Children (indented) */}
                {!isCollapsed && (
                  <div className="flex flex-col gap-0.5 pl-4 pr-1 pb-1 pt-0.5 border-l-2 border-primary/20 ml-2 mb-1">
                    {item.elements.map((el) => {
                      const selected = el.id === selectedId || selectedIds.has(el.id);
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
                          onClick={(e) => handleSelectElement(el.id, e)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect(el.id);
                            }
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs",
                            selected
                              ? "border-primary bg-accent"
                              : "border-transparent hover:bg-accent/40",
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
                            aria-label={`Excluir ${label}`}
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
                )}
              </div>
            );
          }

          // Single Item (Ungrouped)
          const el = item.element;
          const index = elements.findIndex((e) => e.id === el.id);
          const isLast = !pageMode && elements.length <= 1;
          const isTop = index === elements.length - 1;
          const isBottom = index === 0;
          const selected = el.id === selectedId || selectedIds.has(el.id);
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
              onClick={(e) => handleSelectElement(el.id, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(el.id);
                }
              }}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs",
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
    </div>
  );
}
