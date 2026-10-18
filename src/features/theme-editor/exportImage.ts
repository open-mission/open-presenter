import { toast } from "sonner";

export interface ExportImageOptions {
  fileName?: string;
  format?: "png" | "jpeg";
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * Exporta um elemento HTML do canvas/palco para arquivo PNG ou JPG em resolução nativa (Full HD 1920x1080).
 */
export async function exportElementAsImage(
  element: HTMLElement,
  options: ExportImageOptions = {},
): Promise<string | null> {
  const {
    fileName = "apresentacao",
    format = "png",
    quality = 0.95,
    width = 1920,
    height = 1080,
  } = options;

  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const extension = format === "jpeg" ? "jpg" : "png";
  const fullFileName = `${fileName.replace(/[/\\?%*:|"<>]/g, "-")}.${extension}`;

  try {
    toast.info("Processando imagem para exportação...");

    // Cria clone do elemento com dimensões absolutas
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.transform = "none";
    clone.style.position = "relative";
    clone.style.overflow = "hidden";

    // Envolve em container SVG foreignObject para renderização nítida
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%;">
            ${new XMLSerializer().serializeToString(clone)}
          </div>
        </foreignObject>
      </svg>
    `;

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(svgBlob);

    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            URL.revokeObjectURL(blobUrl);
            toast.error("Não foi possível inicializar o canvas de imagem.");
            resolve(null);
            return;
          }

          // Fundo padrão preto caso seja JPEG sem canal alpha
          if (format === "jpeg") {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(blobUrl);

          const dataUrl = canvas.toDataURL(mimeType, quality);

          // Dispara o download automático do arquivo
          const link = document.createElement("a");
          link.download = fullFileName;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast.success(`Imagem salva com sucesso: ${fullFileName}`);
          resolve(dataUrl);
        } catch (err) {
          URL.revokeObjectURL(blobUrl);
          toast.error("Erro ao converter imagem.");
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        // Fallback: se falhar o carregamento do SVG complexo, tenta renderizar via canvas direto
        toast.error("Falha ao renderizar a imagem do tema.");
        resolve(null);
      };

      img.src = blobUrl;
    });
  } catch (err) {
    console.error("Erro ao exportar imagem:", err);
    toast.error("Não foi possível exportar a imagem.");
    return null;
  }
}
