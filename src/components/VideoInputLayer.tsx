import { useEffect, useState } from "react";
import { getServerStatus } from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";

/**
 * URL do feed MJPEG do NDI. Em janela nativa aponta para o servidor embutido
 * em loopback; no navegador/OBS usa a mesma origem.
 */
export function useNdiStreamUrl(): string {
  const [port, setPort] = useState(5050);

  useEffect(() => {
    if (!isTauri()) return;
    void getServerStatus()
      .then((status) => {
        if (status?.port) setPort(status.port);
      })
      .catch(() => {});
  }, []);

  if (!isTauri()) {
    return typeof window !== "undefined"
      ? `${window.location.origin}/ndi/stream`
      : "/ndi/stream";
  }
  return `http://127.0.0.1:${port}/ndi/stream`;
}

/** Camada de Entrada de Vídeo: consome o feed NDI servido em MJPEG. */
export function VideoInputLayer() {
  const src = useNdiStreamUrl();

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="size-full object-cover"
      />
    </div>
  );
}
