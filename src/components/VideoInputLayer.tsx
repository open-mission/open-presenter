import { useEffect, useState } from "react";
import { resolveMediaPort, useMediaPort } from "@/core/config/mediaPort";
import { getNdiInputStatus } from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";

/**
 * URL do feed MJPEG do NDI. Em janela nativa aponta para o servidor embutido
 * em loopback na porta real configurada; no navegador/OBS usa a mesma origem.
 */
export function useNdiStreamUrl(): string {
  const mediaPort = useMediaPort();
  const port = resolveMediaPort(mediaPort ?? undefined);

  if (!isTauri()) {
    return typeof window !== "undefined"
      ? `${window.location.origin}/ndi/stream`
      : "/ndi/stream";
  }
  return `http://127.0.0.1:${port}/ndi/stream`;
}

/** Camada de Entrada de Vídeo: consome o feed NDI servido em MJPEG quando ativo. */
export function VideoInputLayer() {
  const src = useNdiStreamUrl();
  const [active, setActive] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function checkNdi() {
      try {
        const status = await getNdiInputStatus();
        if (!disposed) {
          const isRunning = Boolean(status?.running && status?.source);
          setActive(isRunning);
          if (!isRunning) setHasError(false);
        }
      } catch {
        if (!disposed) setActive(false);
      }
    }

    void checkNdi();
    const interval = setInterval(checkNdi, 3000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  if (!active || hasError) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="size-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
