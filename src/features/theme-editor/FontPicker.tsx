import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/core/lib/utils";

const FONT_FAMILIES = [
  // Sans-Serif Modernas
  { name: "Inter", category: "Sans-Serif" },
  { name: "Roboto", category: "Sans-Serif" },
  { name: "Montserrat", category: "Sans-Serif" },
  { name: "Poppins", category: "Sans-Serif" },
  { name: "Open Sans", category: "Sans-Serif" },
  { name: "Lato", category: "Sans-Serif" },
  { name: "Oswald", category: "Sans-Serif" },
  { name: "Helvetica", category: "Sans-Serif" },
  { name: "Arial", category: "Sans-Serif" },
  { name: "Verdana", category: "Sans-Serif" },
  { name: "Trebuchet MS", category: "Sans-Serif" },
  { name: "system-ui", category: "Sistema" },
  // Display & Impacto
  { name: "Bebas Neue", category: "Display" },
  { name: "Anton", category: "Display" },
  { name: "Impact", category: "Display" },
  // Serif & Elegantes
  { name: "Playfair Display", category: "Serif" },
  { name: "Merriweather", category: "Serif" },
  { name: "Georgia", category: "Serif" },
  { name: "Times New Roman", category: "Serif" },
  { name: "Cinzel", category: "Serif" },
  { name: "Garamond", category: "Serif" },
  // Nerd Fonts, Monospace & Ícones
  { name: "Symbols Nerd Font", category: "Ícones & Nerd" },
  { name: "Nerd Font", category: "Ícones & Nerd" },
  { name: "JetBrains Mono", category: "Monospace" },
  { name: "Fira Code", category: "Monospace" },
  { name: "monospace", category: "Monospace" },
  // Cursivas & Manuscritas
  { name: "Caveat", category: "Manuscrita" },
  { name: "Dancing Script", category: "Manuscrita" },
  { name: "Pacifico", category: "Manuscrita" },
];

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  className?: string;
}

export function FontPicker({ value, onChange, className }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = FONT_FAMILIES.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedDisplay = value || "Arial";

  function handleSelect(font: string) {
    onChange(font);
    setOpen(false);
    setSearch("");
  }

  function handleCustomCommit() {
    if (search.trim()) {
      onChange(search.trim());
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between font-normal text-xs px-2.5 shadow-2xs cursor-pointer",
            className,
          )}
        >
          <span className="truncate" style={{ fontFamily: value || undefined }}>
            {selectedDisplay}
          </span>
          <ChevronDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 mb-1.5">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Pesquisar fonte ou digitar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCustomCommit();
              }
            }}
            className="h-7 border-0 p-0 text-xs shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {search.trim() !== "" &&
          !FONT_FAMILIES.some(
            (f) => f.name.toLowerCase() === search.toLowerCase(),
          ) && (
            <button
              type="button"
              onClick={handleCustomCommit}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-primary hover:bg-muted cursor-pointer mb-1 border border-dashed border-primary/30"
            >
              <span>Usar fonte personalizada: <strong>"{search}"</strong></span>
              <Check className="size-3.5" />
            </button>
          )}

        <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Nenhuma fonte encontrada. Pressione Enter para usar "{search}".
            </div>
          ) : (
            filtered.map((font) => {
              const isSelected = value.toLowerCase() === font.name.toLowerCase();
              return (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => handleSelect(font.name)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer hover:bg-muted",
                    isSelected && "bg-accent font-semibold text-accent-foreground",
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm truncate"
                      style={{ fontFamily: font.name }}
                    >
                      {font.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {font.category}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 text-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
