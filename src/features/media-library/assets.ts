import { useMemo } from "react";
import { useMediaShadersStore } from "@/features/media-shaders/store";
import {
  buildAudioAssets,
  buildImageAssets,
  buildShaderAssets,
  buildVideoAssets,
  type BackgroundAsset,
} from "./types";
import { useMediaFolderLibrary } from "./useMediaFolderLibrary";

export interface MediaLibraryAssetsApi {
  backgrounds: BackgroundAsset[];
  images: BackgroundAsset[];
  videos: BackgroundAsset[];
  audios: BackgroundAsset[];
  shaders: BackgroundAsset[];
  loading: boolean;
}

/** Ativos disponíveis: fundos, imagens da biblioteca, vídeos, áudios e shaders. */
export function useBackgroundAssets(): MediaLibraryAssetsApi {
  const presets = useMediaShadersStore((s) => s.presets);
  const bgLib = useMediaFolderLibrary("backgrounds");
  const imgLib = useMediaFolderLibrary("images");
  const vidLib = useMediaFolderLibrary("videos");
  const audLib = useMediaFolderLibrary("audios");

  return useMemo(() => {
    return {
      backgrounds: buildImageAssets(bgLib.tree),
      images: buildImageAssets(imgLib.tree),
      videos: buildVideoAssets(vidLib.tree),
      audios: buildAudioAssets(audLib.tree),
      shaders: buildShaderAssets(presets),
      loading: bgLib.loading || imgLib.loading || vidLib.loading || audLib.loading,
    };
  }, [
    presets,
    bgLib.tree,
    imgLib.tree,
    vidLib.tree,
    audLib.tree,
    bgLib.loading,
    imgLib.loading,
    vidLib.loading,
    audLib.loading,
  ]);
}
