import { useSearchParams } from "react-router-dom";

export default function ThemeEditorView() {
  const [searchParams] = useSearchParams();
  const guid = searchParams.get("guid") ?? "";

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
      <h1 className="text-lg font-semibold">Editor de Temas</h1>
      <p className="text-sm text-muted-foreground">
        {guid ? `Editando tema: ${guid}` : "Nenhum tema selecionado"}
      </p>
    </div>
  );
}
