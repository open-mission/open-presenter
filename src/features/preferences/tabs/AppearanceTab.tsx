import { CheckCircle2, Laptop, Moon, Sun } from "lucide-react";
import { getResolvedTheme, type ThemeMode } from "@/core/theme/theme";
import { usePreferencesStore } from "../store";

interface ThemeOption {
  id: ThemeMode;
  title: string;
  subtitle: string;
  icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "light",
    title: "Claro",
    subtitle: "Interface clara com alto contraste para ambientes iluminados.",
    icon: Sun,
  },
  {
    id: "dark",
    title: "Escuro",
    subtitle: "Ideal para cabines de som, igrejas e eventos com pouca luz.",
    icon: Moon,
  },
  {
    id: "system",
    title: "Sistema",
    subtitle: "Acompanha automaticamente as preferências do sistema operacional.",
    icon: Laptop,
  },
];

export function AppearanceTab() {
  const currentTheme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const resolved = getResolvedTheme(currentTheme);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Tema da Interface
        </h3>
        <p className="text-xs text-muted-foreground">
          Defina a aparência da área de operação do aplicativo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const isSelected = currentTheme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                  : "border-border/80 bg-card/60 hover:border-zinc-400/60 hover:bg-accent/30 dark:hover:border-zinc-700"
              }`}
            >
              {/* Swatch Preview */}
              <div className="mb-4 h-16 w-full overflow-hidden rounded-lg border border-border/60">
                {opt.id === "light" && (
                  <div className="flex h-full w-full flex-col bg-zinc-100 p-2 text-zinc-900">
                    <div className="h-2 w-12 rounded bg-zinc-300" />
                    <div className="mt-auto flex gap-1.5">
                      <div className="h-5 w-10 rounded bg-white border border-zinc-200" />
                      <div className="h-5 flex-1 rounded bg-zinc-200" />
                    </div>
                  </div>
                )}
                {opt.id === "dark" && (
                  <div className="flex h-full w-full flex-col bg-zinc-950 p-2 text-zinc-100">
                    <div className="h-2 w-12 rounded bg-zinc-800" />
                    <div className="mt-auto flex gap-1.5">
                      <div className="h-5 w-10 rounded bg-zinc-900 border border-zinc-800" />
                      <div className="h-5 flex-1 rounded bg-zinc-800/80" />
                    </div>
                  </div>
                )}
                {opt.id === "system" && (
                  <div className="flex h-full w-full">
                    <div className="flex h-full w-1/2 flex-col justify-between bg-zinc-100 p-2">
                      <div className="h-2 w-8 rounded bg-zinc-300" />
                      <div className="h-4 w-full rounded bg-white border border-zinc-200" />
                    </div>
                    <div className="flex h-full w-1/2 flex-col justify-between bg-zinc-950 p-2 border-l border-zinc-700/50">
                      <div className="h-2 w-8 rounded bg-zinc-800" />
                      <div className="h-4 w-full rounded bg-zinc-900 border border-zinc-800" />
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Check */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-foreground/80" />
                    <span className="font-semibold text-sm text-foreground">
                      {opt.title}
                    </span>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : (
                    <div className="size-4 rounded-full border border-muted-foreground/30" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {opt.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tema ativo no operador:{" "}
        <span className="font-semibold text-foreground capitalize">
          {resolved === "dark" ? "Escuro" : "Claro"}
        </span>
        {currentTheme === "system" && " (definido pelo sistema)"}. Telas públicas e de retorno operam com fundo preto e iluminação independente.
      </p>
    </div>
  );
}
