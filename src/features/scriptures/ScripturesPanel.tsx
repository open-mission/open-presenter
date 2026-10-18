import { BookOpen, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePresentationStore } from "../presentation/store";
import { searchVerses, useScripturesStore } from "./store";

export function ScripturesPanel() {
  const verses = useScripturesStore((s) => s.verses);
  const query = useScripturesStore((s) => s.query);
  const setQuery = useScripturesStore((s) => s.setQuery);
  const setPreview = usePresentationStore((s) => s.setPreview);

  const results = searchVerses(verses, query);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bíblia · Busca rápida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Buscar referência ou texto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {results.map((verse) => (
          <Button
            key={verse.id}
            variant="secondary"
            className="h-auto justify-start py-2 text-left"
            onClick={() =>
              setPreview({
                id: verse.id,
                kind: "scripture",
                title: verse.reference,
                lines: [verse.text],
              })
            }
          >
            <BookOpen size={14} className="shrink-0" />
            <span className="truncate">
              {verse.reference}
              <span className="text-zinc-400"> · {verse.text}</span>
            </span>
          </Button>
        ))}
        {results.length === 0 && (
          <p className="text-sm text-zinc-400">Nenhum versículo encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
}
