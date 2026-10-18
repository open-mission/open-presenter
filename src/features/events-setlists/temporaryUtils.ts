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

  const updatedTarget = appendItemToEvent(target, itemToMove);

  return {
    updatedSource: { ...source, parts: cleanedSourceParts },
    updatedTarget,
    movedItem: itemToMove,
  };
}

export function appendItemToEvent(
  event: ServiceEvent,
  item: EventItem,
): ServiceEvent {
  if (event.parts.length === 0) {
    return {
      ...event,
      parts: [
        {
          id: crypto.randomUUID(),
          title: "Avulsas",
          items: [item],
        },
      ],
    };
  }

  return {
    ...event,
    parts: event.parts.map((part, index) => {
      if (index === event.parts.length - 1) {
        return {
          ...part,
          items: [...part.items, item],
        };
      }
      return part;
    }),
  };
}
