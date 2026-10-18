import type { EventItem, EventPart, ServiceEvent } from "@/core/types";

function clearPointers(item: EventItem, removedIds: ReadonlySet<string>): EventItem {
  if (item.nextItemId === null || !removedIds.has(item.nextItemId)) return item;
  return { ...item, nextItemId: null };
}

export function transferItemBetweenEvents(
  source: ServiceEvent,
  target: ServiceEvent,
  itemId: string,
): { updatedSource: ServiceEvent; updatedTarget: ServiceEvent; movedItem: EventItem } | null {
  let foundItem: EventItem | null = null;

  const newSourceParts: EventPart[] = source.parts.map((part) => {
    const item = part.items.find((i) => i.id === itemId);
    if (item) {
      foundItem = item;
      return {
        ...part,
        items: part.items.filter((i) => i.id !== itemId),
      };
    }
    return part;
  });

  if (!foundItem) return null;

  const removedIds = new Set([itemId]);
  const cleanedSourceParts = newSourceParts.map((part) => ({
    ...part,
    items: part.items.map((i) => clearPointers(i, removedIds)),
  }));

  const itemToMove: EventItem = {
    ...(foundItem as EventItem),
    nextItemId: null,
  };

  let newTargetParts: EventPart[];
  if (target.parts.length === 0) {
    newTargetParts = [
      {
        id: crypto.randomUUID(),
        title: "Avulsas",
        items: [itemToMove],
      },
    ];
  } else {
    newTargetParts = target.parts.map((part, index) => {
      if (index === target.parts.length - 1) {
        return {
          ...part,
          items: [...part.items, itemToMove],
        };
      }
      return part;
    });
  }

  return {
    updatedSource: { ...source, parts: cleanedSourceParts },
    updatedTarget: { ...target, parts: newTargetParts },
    movedItem: itemToMove,
  };
}
