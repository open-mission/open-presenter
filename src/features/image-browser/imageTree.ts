import type { TreeDataItem } from "@/components/ui/tree";
import type { ImageTreeNode } from "@/core/types";

export function countImages(node: ImageTreeNode): number {
  if (node.kind === "image") return 1;
  return (node.children ?? []).reduce(
    (total, child) => total + countImages(child),
    0,
  );
}

export function flattenImages(node: ImageTreeNode): ImageTreeNode[] {
  if (node.kind === "image") return [node];
  return (node.children ?? []).flatMap(flattenImages);
}

export function findImageNode(
  nodes: ImageTreeNode[],
  path: string,
): ImageTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findImageNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function findImageParent(
  nodes: ImageTreeNode[],
  path: string,
): ImageTreeNode | null {
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    if ((node.children ?? []).some((child) => child.path === path)) {
      return node;
    }
    const found = findImageParent(node.children ?? [], path);
    if (found) return found;
  }
  return null;
}

export function filterImageFolders(nodes: ImageTreeNode[]): ImageTreeNode[] {
  return nodes
    .filter((node) => node.kind === "folder")
    .map((node) => ({
      ...node,
      children: filterImageFolders(node.children ?? []),
    }));
}

export function toTreeItems(nodes: ImageTreeNode[]): TreeDataItem[] {
  return nodes.map((node) => ({
    id: node.path,
    name: node.name,
    kind: node.kind === "folder" ? "folder" : "file",
    meta: node.kind === "folder" ? String(countImages(node)) : undefined,
    children: node.children ? toTreeItems(node.children) : undefined,
  }));
}

export function mediaPathToImageRelative(path: string | null): string | null {
  if (!path) return null;
  return path.replace(/^media:\/\/library\/images\//, "");
}
