import type { BackgroundLayer, ImageTreeNode, OutputCategory } from "@/core/types";

export type BackgroundAssetKind = "color" | "image" | "video" | "shader";
export type BackgroundAssetCategory = OutputCategory | "any";

export interface BackgroundAsset {
  id: string;
  name: string;
  kind: BackgroundAssetKind;
  source: string;
  category: BackgroundAssetCategory;
  tags?: string[];
}

export const ASSET_DND_MIME = "application/x-open-presenter-asset";

export type AssetDragPayload =
  | { type: "theme"; themeGuid: string }
  | { type: "background"; asset: BackgroundAsset };

/**
 * Compatibilidade de fundo por categoria. Ativo sem categoria é tratado como
 * `public` (nunca `any`); `any` aceita qualquer saída.
 */
export function assetSupportsOutput(
  asset: BackgroundAsset,
  category: OutputCategory,
): boolean {
  if (asset.category === "any") return true;
  return asset.category === category;
}

export function backgroundFromAsset(asset: BackgroundAsset): BackgroundLayer {
  if (asset.kind === "shader") {
    return {
      id: asset.id,
      kind: asset.source.trim().startsWith("isf:") ? "isf" : "css",
      value: asset.source,
    };
  }
  return {
    id: asset.id,
    kind: asset.kind === "video" ? "video" : asset.kind === "color" ? "color" : "image",
    value: asset.source,
  };
}

/**
 * Ativos sem marcação explícita viram `public`. Só pastas/nomes com indício de
 * Lower Third são classificados como `lower`.
 */
export function inferImageCategory(pathOrName: string): "lower" | "public" {
  const value = pathOrName.toLowerCase();
  return ["lower", "terceira", "vinheta", "legenda"].some((key) => value.includes(key))
    ? "lower"
    : "public";
}

function flattenImageNodes(nodes: ImageTreeNode[]): ImageTreeNode[] {
  return nodes.flatMap((node) =>
    node.kind === "image" ? [node] : flattenImageNodes(node.children ?? []),
  );
}

export function buildImageAssets(tree: ImageTreeNode[]): BackgroundAsset[] {
  return flattenImageNodes(tree)
    .filter((node) => node.kind === "image" && Boolean(node.url))
    .map((node) => ({
      id: `img:${node.path}`,
      name: node.name,
      kind: "image" as const,
      source: node.url ?? node.path,
      category: inferImageCategory(`${node.path} ${node.name}`),
      tags: [node.path],
    }));
}

const SHADER_LABELS: Record<string, string> = {
  "bg-sunset": "Pôr do sol",
  "bg-night": "Noite",
  "bg-isf-demo": "Plasma (ISF)",
};

export function buildShaderAssets(presets: BackgroundLayer[]): BackgroundAsset[] {
  return presets
    .filter((preset) => preset.kind !== "color")
    .map((preset) => {
      const source =
        preset.kind === "isf" && !preset.value.startsWith("isf:")
          ? `isf:${preset.value}`
          : preset.value;
      return {
        id: `shader:${preset.id}`,
        name: SHADER_LABELS[preset.id] ?? preset.id,
        kind: "shader" as const,
        source,
        category: "public" as const,
        tags: [preset.kind],
      };
    });
}
