import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useDisplaysStore } from "@/features/displays/store";
import PublicView from "./PublicView";
import StageView from "./StageView";
import StreamView from "./StreamView";
import { useDisplaysSync } from "@/features/displays/useDisplaysSync";

export default function DynamicOutputView() {
  useDisplaysSync();

  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const outputId = searchParams.get("id");

  // Garante que a store carregue os dados do backend Rust nesta janela
  useEffect(() => {
    void useDisplaysStore.getState().load();
  }, []);

  const outputs = useDisplaysStore((s) => s.outputs);

  const output = useMemo(() => {
    if (outputId) {
      return outputs.find((o) => o.id === outputId);
    }
    if (slug) {
      const lower = slug.toLowerCase();
      return (
        outputs.find((o) => o.slug?.toLowerCase() === lower) ??
        outputs.find(
          (o) =>
            o.name.toLowerCase().replace(/\s+/g, "-") === lower,
        ) ??
        outputs.find((o) => o.id === slug)
      );
    }
    return null;
  }, [outputs, slug, outputId]);

  // Document title updates to reflect the output name
  useEffect(() => {
    if (output) {
      document.title = `${output.name} — Open Presenter`;
    }
  }, [output]);

  // Determine category
  const categoryParam = searchParams.get("category");
  const category =
    (categoryParam as "public" | "stage" | "lower") ??
    output?.category ??
    (slug === "stage" || slug?.includes("stage") || slug?.includes("palco") || slug?.includes("retorno")
      ? "stage"
      : slug === "stream" || slug === "lower" || slug?.includes("lower") || slug?.includes("obs") || slug?.includes("transmissao")
        ? "lower"
        : "public");

  const isTransparent =
    category === "lower" ||
    output?.alphaKey ||
    output?.backgroundColor === "transparent" ||
    output?.backgroundColor?.startsWith("rgba(0, 0, 0, 0)") ||
    output?.backgroundColor?.startsWith("rgba(0,0,0,0)");

  const bgStyle = output?.backgroundColorEnabled && !isTransparent
    ? { backgroundColor: output.backgroundColor }
    : undefined;

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={bgStyle}
    >
      {category === "stage" ? (
        <StageView
          backgroundColor={output?.backgroundColorEnabled ? output.backgroundColor : undefined}
          outputId={output?.id}
        />
      ) : category === "lower" ? (
        <StreamView
          backgroundColor={output?.backgroundColorEnabled ? output.backgroundColor : undefined}
          outputId={output?.id}
        />
      ) : (
        <PublicView
          backgroundColor={output?.backgroundColorEnabled ? output.backgroundColor : undefined}
          outputId={output?.id}
        />
      )}
    </div>
  );
}
