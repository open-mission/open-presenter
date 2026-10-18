import { useState } from "react";
import { Smile, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SymbolItem {
  char: string;
  name: string;
  category: string;
}

const SYMBOLS: SymbolItem[] = [
  // Tempo & Cronômetros (Muito pedido!)
  { char: "⏱", name: "Cronômetro", category: "Tempo" },
  { char: "⏳", name: "Ampulheta", category: "Tempo" },
  { char: "🕒", name: "Relógio 3h", category: "Tempo" },
  { char: "⏰", name: "Despertador", category: "Tempo" },
  { char: "⌛", name: "Areia correndo", category: "Tempo" },
  { char: "⚡", name: "Raio / Alerta", category: "Tempo" },
  // Louvor & Música
  { char: "🎵", name: "Nota musical", category: "Música" },
  { char: "🎶", name: "Notas musicais", category: "Música" },
  { char: "🎤", name: "Microfone", category: "Música" },
  { char: "🎸", name: "Violão / Guitarra", category: "Música" },
  { char: "🎹", name: "Teclado / Piano", category: "Música" },
  { char: "🥁", name: "Bateria", category: "Música" },
  { char: "🎷", name: "Saxofone", category: "Música" },
  { char: "🎺", name: "Trompete", category: "Música" },
  // Fé & Igreja
  { char: "✝", name: "Cruz latina", category: "Igreja" },
  { char: "📖", name: "Bíblia aberta", category: "Igreja" },
  { char: "⛪", name: "Igreja", category: "Igreja" },
  { char: "🕊", name: "Pomba da paz", category: "Igreja" },
  { char: "🙏", name: "Mãos em oração", category: "Igreja" },
  { char: "🕯", name: "Vela acesa", category: "Igreja" },
  { char: "📜", name: "Pergaminho", category: "Igreja" },
  { char: "✨", name: "Brilho / Glória", category: "Igreja" },
  { char: "👑", name: "Coroa", category: "Igreja" },
  // Controles & Playback
  { char: "▶", name: "Play", category: "Controle" },
  { char: "⏸", name: "Pause", category: "Controle" },
  { char: "⏹", name: "Stop", category: "Controle" },
  { char: "⏭", name: "Avançar", category: "Controle" },
  { char: "⏮", name: "Retroceder", category: "Controle" },
  { char: "▲", name: "Seta cima", category: "Controle" },
  { char: "▼", name: "Seta baixo", category: "Controle" },
  { char: "◀", name: "Seta esquerda", category: "Controle" },
  { char: "▶", name: "Seta direita", category: "Controle" },
  // Formas & Pontos
  { char: "●", name: "Círculo preenchido", category: "Formas" },
  { char: "○", name: "Círculo vazado", category: "Formas" },
  { char: "■", name: "Quadrado", category: "Formas" },
  { char: "◆", name: "Losango", category: "Formas" },
  { char: "★", name: "Estrela", category: "Formas" },
  { char: "✦", name: "Estrela de 4 pontas", category: "Formas" },
  { char: "✓", name: "Check / Marcador", category: "Formas" },
  { char: "•", name: "Bullet", category: "Formas" },
  { char: "·", name: "Ponto central", category: "Formas" },
  { char: "―", name: "Travessão longo", category: "Formas" },
];

interface SymbolsPickerProps {
  onInsert: (char: string) => void;
  title?: string;
  className?: string;
}

export function SymbolsPicker({
  onInsert,
  title = "Inserir Símbolo / Ícone",
  className,
}: SymbolsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = SYMBOLS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()) ||
      s.char.includes(search),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className}
          title={title}
        >
          <Smile className="size-3.5 mr-1" />
          <span>Símbolos</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2.5" align="start">
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 mb-2">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Pesquisar símbolo (ex: relógio, cruz, nota)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 border-0 p-0 text-xs shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto p-1">
          {filtered.map((item) => (
            <button
              key={item.char + item.name}
              type="button"
              onClick={() => {
                onInsert(item.char);
                setOpen(false);
              }}
              className="flex size-9 items-center justify-center rounded-md text-base hover:bg-muted hover:scale-110 active:scale-95 transition-all cursor-pointer border border-border/40"
              title={`${item.name} (${item.category})`}
            >
              {item.char}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
