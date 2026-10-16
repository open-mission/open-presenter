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
    subtitle: "Visual clássico de alto contraste para ambientes bem iluminados.",
    icon: Sun,
  },
  {
    id: "dark",
    title: "Escuro",
    subtitle: "Recomendado para cabines de som, igrejas e eventos com pouca luz.",
    icon: Moon,
  },
  {
    id: "system",
    title: "Igual ao Sistema",
    subtitle: "Acompanha automaticamente as preferências de tema do seu sistema operacional.",
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
        <p className="text-sm text-muted-foreground">
          Escolha como a interface do operador é exibida. A preferência é salva localmente no seu dispositivo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const isSelected = currentTheme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`group relative flex flex-col items-start rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                  : "border-border bg-card/50 hover:border-zinc-400/50 hover:bg-accent/40 dark:hover:border-zinc-700"
              }`}
            >
              {/* Visual Mini Preview Window */}
              <div className="relative mb-3.5 h-24 w-full overflow-hidden rounded-lg border border-border/80 shadow-xs">
                {opt.id === "light" && (
                  <div className="h-full w-full bg-zinc-50 p-2">
                    <div className="flex h-3 items-center gap-1 border-b border-zinc-200 pb-1">
                      <div className="size-1.5 rounded-full bg-zinc-300" />
                      <div className="size-1.5 rounded-full bg-zinc-300" />
                      <div className="size-1.5 rounded-full bg-zinc-300" />
                      <div className="ml-1 h-1.5 w-10 rounded-sm bg-zinc-200" />
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <div className="h-12 w-6 rounded bg-zinc-200/80" />
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="h-2 w-3/4 rounded bg-zinc-300" />
                        <div className="h-5 rounded border border-zinc-200 bg-white p-1">
                          <div className="h-1.5 w-1/2 rounded bg-zinc-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {opt.id === "dark" && (
                  <div className="h-full w-full bg-zinc-950 p-2 text-zinc-100">
                    <div className="flex h-3 items-center gap-1 border-b border-zinc-800 pb-1">
                      <div className="size-1.5 rounded-full bg-zinc-700" />
                      <div className="size-1.5 rounded-full bg-zinc-700" />
                      <div className="size-1.5 rounded-full bg-zinc-700" />
                      <div className="ml-1 h-1.5 w-10 rounded-sm bg-zinc-800" />
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <div className="h-12 w-6 rounded bg-zinc-800/80" />
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="h-2 w-3/4 rounded bg-zinc-700" />
                        <div className="h-5 rounded border border-zinc-800 bg-zinc-900 p-1">
                          <div className="h-1.5 w-1/2 rounded bg-zinc-800" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {opt.id === "system" && (
                  <div className="relative flex h-full w-full">
                    {/* Light Half */}
                    <div className="flex h-full w-1/2 flex-col bg-zinc-100 p-2">
                      <div className="flex h-3 items-center gap-1 border-b border-zinc-200 pb-1">
                        <div className="size-1.5 rounded-full bg-zinc-300" />
                        <div className="size-1.5 rounded-full bg-zinc-300" />
                      </div>
                      <div className="mt-2 h-10 w-full rounded bg-white shadow-2xs" />
                    </div>
                    {/* Dark Half */}
                    <div className="flex h-full w-1/2 flex-col bg-zinc-950 p-2">
                      <div className="flex h-3 items-center justify-end gap-1 border-b border-zinc-800 pb-1">
                        <div className="size-1.5 rounded-full bg-zinc-700" />
                        <div className="size-1.5 rounded-full bg-zinc-700" />
                      </div>
                      <div className="mt-2 h-10 w-full rounded bg-zinc-900 shadow-2xs" />
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-400/40" />
                  </div>
                )}
              </div>

              {/* Header and Check */}
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-foreground/80" />
                  <span className="font-semibold text-sm text-foreground">
                    {opt.title}
                  </span>
                </div>
                {isSelected ? (
                  <CheckCircle2 className="size-4.5 text-primary" />
                ) : (
                  <div className="size-4.5 rounded-full border border-muted-foreground/30" />
                )}
              </div>

              {/* Subtitle */}
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {opt.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border/80 bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-background p-1.5 text-foreground shadow-2xs">
            <Laptop className="size-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              Tema atual efetivo:{" "}
              <span className="capitalize text-primary">
                {resolved === "dark" ? "Escuro" : "Claro"}
              </span>
              {currentTheme === "system" && " (definido pelo sistema operacional)"}
            </p>
            <p className="text-xs text-muted-foreground leading-normal">
              O tema selecionado acima altera toda a área administrativa do operador. As saídas de projeção pública (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">/public</code>) e palco (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">/stage</code>) mantêm a renderização em tela cheia com fundo preto e camadas de vídeo para máxima qualidade ótica.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
