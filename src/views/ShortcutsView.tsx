import { useEffect, useState } from "react";
import {
  Keyboard,
  Music,
  Tv,
  Navigation,
  Settings,
  Search,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/core/config/version";
import { closeShortcutsWindow } from "@/core/ipc/commands";

interface ShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
}

interface ShortcutCategory {
  title: string;
  icon: typeof Keyboard;
  items: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Apresentação & Ao Vivo",
    icon: Tv,
    items: [
      {
        keys: ["ESC"],
        description: "Cancela e limpa a apresentação ativa na projeção pública",
      },
      {
        keys: ["→", "ou", "Espaço"],
        description: "Avança para o próximo slide da apresentação ativa",
      },
      {
        keys: ["←"],
        description: "Volta para o slide anterior da apresentação ativa",
      },
      {
        keys: ["Enter"],
        description: "Projeta o slide selecionado imediatamente na tela pública",
      },
      {
        keys: ["B"],
        description: "Blackout: escurece totalmente a tela pública",
      },
      {
        keys: ["C"],
        description: "Clear: limpa o texto mantendo o fundo na tela pública",
      },
    ],
  },
  {
    title: "Navegação de Slides",
    icon: Navigation,
    items: [
      {
        keys: ["↓"],
        description: "Navega para o slide seguinte sem alterar a projeção pública",
      },
      {
        keys: ["↑"],
        description: "Navega para o slide anterior sem alterar a projeção pública",
      },
      {
        keys: ["Clique"],
        description: "Seleciona o slide para pré-visualização no operador",
      },
      {
        keys: ["Duplo Clique"],
        description: "Projeta o slide diretamente na saída pública",
      },
      {
        keys: ["0–9", "Enter"],
        description:
          "Digite o número do slide (música, texto ou imagem) e Enter para ir até ele; projeta se a apresentação estiver ativa, senão faz prévia e rolagem",
      },
      {
        keys: ["Backspace"],
        description: "Apaga o último dígito do número digitado",
      },
    ],
  },
  {
    title: "Músicas & Repertório",
    icon: Music,
    items: [
      {
        keys: ["⌘ / Ctrl", "N"],
        description: "Criar uma nova música no repertório",
      },
      {
        keys: ["⌘ / Ctrl", "Shift", "F"],
        description: "Buscar letras de músicas online na internet",
      },
      {
        keys: ["Botão Direito"],
        description: "Menu com opção de Editar música, mover na ordem ou remover",
      },
      {
        keys: ["V", "C", "B", "…"],
        description:
          "Pula para o início do próximo grupo do rótulo (Verso, Refrão…); letras configuráveis em Preferências → Músicas. No painel de letras, têm prioridade sobre B/C/F.",
      },
    ],
  },
  {
    title: "Geral & Janelas",
    icon: Settings,
    items: [
      {
        keys: ["⌘ / Ctrl", ","],
        description: "Abrir janela de Preferências e Configurações",
      },
      {
        keys: ["⌘ / Ctrl", "/"],
        description: "Abrir esta tela de Atalhos de Teclado",
      },
      {
        keys: ["⌘ / Ctrl", "S"],
        description: "Salvar alterações na programação ativa",
      },
      {
        keys: ["ESC"],
        description: "Fechar janelas suspensas, diálogos e modais",
      },
    ],
  },
];

export default function ShortcutsView() {
  const [search, setSearch] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        void closeShortcutsWindow();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const needle = search.trim().toLowerCase();

  const filteredCategories = SHORTCUT_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.description.toLowerCase().includes(needle) ||
        item.keys.some((k) => k.toLowerCase().includes(needle)),
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground select-none overflow-hidden font-sans">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5 bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Keyboard className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">
              Atalhos de Teclado
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Agilidade na operação de projeção e controle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar atalhos…"
              className="h-8 w-44 sm:w-56 rounded-md border border-input bg-background/80 pr-2 pl-8 text-xs text-foreground placeholder:text-muted-foreground shadow-2xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => void closeShortcutsWindow()}
            title="Fechar (ESC)"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 [scrollbar-gutter:stable]">
        {filteredCategories.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Search className="size-6 opacity-40" />
            <p>Nenhum atalho encontrado para &quot;{search}&quot;</p>
          </div>
        ) : (
          filteredCategories.map((category) => {
            const Icon = category.icon;
            return (
              <section key={category.title} className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  <Icon className="size-3.5 text-primary" />
                  <span>{category.title}</span>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70 bg-card/50 shadow-2xs divide-y divide-border/50">
                  {category.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-xs text-foreground">
                        {item.description}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.keys.map((k, kIdx) =>
                          k === "ou" ? (
                            <span
                              key={kIdx}
                              className="text-[10px] text-muted-foreground px-0.5"
                            >
                              ou
                            </span>
                          ) : (
                            <kbd
                              key={kIdx}
                              className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-border/80 bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-2xs"
                            >
                              {k}
                            </kbd>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* Footer */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border px-5 text-[11px] text-muted-foreground bg-muted/20">
        <span>Dica: Pressione <kbd className="font-mono font-semibold px-1 py-0.5 rounded border border-border bg-muted text-foreground">ESC</kbd> a qualquer momento para fechar</span>
        <span className="flex items-center gap-1.5">
          <BrandMark className="size-3.5" />
          Open Presenter v{APP_VERSION}
        </span>
      </footer>
    </div>
  );
}
