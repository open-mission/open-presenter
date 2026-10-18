import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/core/lib/utils";

export interface TreeDataItem {
  id: string;
  name: string;
  kind: "folder" | "file";
  children?: TreeDataItem[];
  meta?: string;
}

interface TreeProps {
  items: TreeDataItem[];
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: TreeDataItem) => void;
  renderIcon: (item: TreeDataItem, expanded: boolean) => ReactNode;
  emptyLabel?: string;
  className?: string;
}

export function Tree({
  items,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
  renderIcon,
  emptyLabel = "Nenhum item.",
  className,
}: TreeProps) {
  if (items.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <ul role="tree" className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item) => (
        <TreeRow
          key={item.id}
          item={item}
          depth={0}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
          renderIcon={renderIcon}
        />
      ))}
    </ul>
  );
}

function TreeRow({
  item,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
  renderIcon,
}: {
  item: TreeDataItem;
  depth: number;
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: TreeDataItem) => void;
  renderIcon: (item: TreeDataItem, expanded: boolean) => ReactNode;
}) {
  const isFolder = item.kind === "folder";
  const isExpanded = isFolder && expandedIds.has(item.id);
  const isSelected = selectedId === item.id;
  const hasChildren = isFolder && (item.children?.length ?? 0) > 0;

  return (
    <li
      role="treeitem"
      aria-expanded={isFolder ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div
        className={cn(
          "group flex items-center rounded-md pr-1 transition-colors",
          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring outline-none cursor-pointer"
            aria-label={isExpanded ? "Recolher pasta" : "Expandir pasta"}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onSelect(item)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm cursor-pointer"
        >
          <span className="shrink-0">{renderIcon(item, isExpanded)}</span>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.meta && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {item.meta}
            </span>
          )}
        </button>
      </div>

      {isFolder && isExpanded && hasChildren && (
        <ul role="group" className="flex flex-col gap-0.5">
          {item.children!.map((child) => (
            <TreeRow
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              renderIcon={renderIcon}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
