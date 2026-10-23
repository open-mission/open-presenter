import { useMemo } from "react";
import { useMediaShadersStore } from "@/features/media-shaders/store";
import { useImageLibrary } from "@/features/image-browser/useImageLibrary";
import {
  buildImageAssets,
  buildShaderAssets,
  type BackgroundAsset,
} from "./types";

export interface BackgroundAssetsApi {
  images: BackgroundAsset[];
  shaders: BackgroundAsset[];
  loading: boolean;
}

/** Fundos disponíveis: presets de shader + imagens da biblioteca. */
export function useBackgroundAssets(): BackgroundAssetsApi {
  const presets = useMediaShadersStore((s) => s.presets);
  const library = useImageLibrary();

  return useMemo(() => {
    return {
      images: buildImageAssets(library.tree),
      shaders: buildShaderAssets(presets),
      loading: library.loading,
    };
  }, [presets, library.tree, library.loading]);
}
