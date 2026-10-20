import { useEffect } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCode2,
  Laptop,
  Moon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import { getResolvedTheme, type ThemeMode } from "@/core/theme/theme";
import {
  PRESETS,
  TOKEN_DEFINITIONS,
  type UiTheme,
  type UiThemeMode,
  type UiThemePalette,
  type UiThemePreset,
} from "@/core/theme/uiTheme";
import { usePreferencesStore } from "../store";
import { ColorField } from "../components/ColorField";
import { ThemePreview } from "../components/ThemePreview";
import { exportUiThemeCss, exportUiThemeJson, importUiThemeFile } from "../uiThemeIo";
import { initUiThemeStoreSync, useUiThemeStore } from "../uiThemeStore";

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

function PalettePreview({
  palette,
  className,
}: {
  palette: UiThemePalette;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-full w-full flex-col justify-between p-1.5", className)}
      style={{ backgroundColor: palette.background, color: palette.foreground }}
    >
      <div className="flex items-center gap-1">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: palette.primary }}
        />
        <span
          className="h-1.5 w-6 rounded-full opacity-70"
          style={{ backgroundColor: palette.foreground }}
        />
      </div>
      <div className="flex items-end gap-1">
        <span
          className="h-4 w-7 rounded-sm border"
          style={{
            backgroundColor: palette.card,
            borderColor: palette.border,
          }}
        />
        <span
          className="h-4 flex-1 rounded-sm"
          style={{ backgroundColor: palette.muted }}
        />
        <span
          className="h-4 w-2 rounded-sm"
          style={{ backgroundColor: palette.primary }}
        />
      </div>
    </div>
  );
}

function ModePreview({ theme, mode }: { theme: UiTheme; mode: ThemeMode }) {
  if (mode === "system") {
    return (
      <div className="flex h-full w-full">
        <div className="w-1/2">
          <PalettePreview palette={theme.light} />
        </div>
        <div className="w-1/2 border-l border-black/10 dark:border-white/10">
          <PalettePreview palette={theme.dark} />
        </div>
      </div>
    );
  }

  return <PalettePreview palette={theme[mode]} />;
}

function ModeCard({
  option,
  theme,
  selected,
  onSelect,
}: {
  option: ThemeOption;
  theme: UiTheme;
  selected: boolean;
  onSelect(): void;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
          : "border-border/80 bg-card/60 hover:border-zinc-400/60 hover:bg-accent/30 dark:hover:border-zinc-700",
      )}
    >
      <div className="mb-4 h-16 w-full overflow-hidden rounded-lg border border-border/60">
        <ModePreview theme={theme} mode={option.id} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-foreground/80" />
            <span className="text-sm font-semibold text-foreground">
              {option.title}
            </span>
          </div>
          {selected ? (
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
          ) : (
            <div className="size-4 shrink-0 rounded-full border border-muted-foreground/30" />
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {option.subtitle}
        </p>
      </div>
    </button>
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: UiThemePreset;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={preset.description}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border p-2 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
          : "border-border/70 bg-background/40 hover:border-border hover:bg-accent/30",
      )}
    >
      <div className="flex h-12 overflow-hidden rounded-lg border border-border/50">
        <div className="w-1/2">
          <PalettePreview palette={preset.theme.light} />
        </div>
        <div className="w-1/2 border-l border-black/10 dark:border-white/10">
          <PalettePreview palette={preset.theme.dark} />
        </div>
      </div>
      <span className="flex items-center justify-between gap-2 px-0.5">
        <span className="truncate text-xs font-semibold text-foreground">
          {preset.name}
        </span>
        {selected && <Check className="size-3.5 shrink-0 text-primary" />}
      </span>
    </button>
  );
}

function formatRadius(value: number): string {
  return value
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

export function AppearanceTab() {
  const currentTheme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const resolved = getResolvedTheme(currentTheme);

  const uiTheme = useUiThemeStore((s) => s.theme);
  const paletteMode = useUiThemeStore((s) => s.paletteMode);
  const setPaletteMode = useUiThemeStore((s) => s.setPaletteMode);
  const selectPreset = useUiThemeStore((s) => s.selectPreset);
  const setToken = useUiThemeStore((s) => s.setToken);
  const setRadius = useUiThemeStore((s) => s.setRadius);
  const reset = useUiThemeStore((s) => s.reset);
  const replaceTheme = useUiThemeStore((s) => s.replaceTheme);
  const syncFromStorage = useUiThemeStore((s) => s.syncFromStorage);

  useEffect(() => {
    syncFromStorage();
    return initUiThemeStoreSync();
  }, [syncFromStorage]);

  useEffect(() => {
    setPaletteMode(resolved);
  }, [resolved, setPaletteMode]);

  const palette = uiTheme[paletteMode];
  const coreTokens = TOKEN_DEFINITIONS.filter(
    (token) => token.group !== "charts" && token.group !== "sidebar",
  );
  const advancedTokens = TOKEN_DEFINITIONS.filter(
    (token) => token.group === "charts" || token.group === "sidebar",
  );
  const parsedRadius = Number.parseFloat(uiTheme.radius);
  const radiusValue = Number.isFinite(parsedRadius) ? parsedRadius : 0.625;

  async function handleImport() {
    const imported = await importUiThemeFile();
    if (imported) replaceTheme(imported);
  }

  return (
    <div className="flex flex-col gap-6 pb-2">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Modo de aparência
            </h3>
            <p className="text-xs text-muted-foreground">
              Defina a aparência da área de operação do aplicativo.
            </p>
          </div>
          <span className="rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            Ativo:{" "}
            <span className="font-semibold text-foreground">
              {resolved === "dark" ? "Escuro" : "Claro"}
            </span>
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => (
            <ModeCard
              key={option.id}
              option={option}
              theme={uiTheme}
              selected={currentTheme === option.id}
              onSelect={() => setTheme(option.id)}
            />
          ))}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          {currentTheme === "system" && "O modo acompanha o sistema. "}
          As telas públicas e de retorno continuam usando os temas de projeção,
          com fundo preto e iluminação independente.
        </p>
      </section>

      <section className="rounded-2xl border border-border/80 bg-card/30 p-4 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Paleta da interface
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Presets inspirados no shadcn/ui. Escolha um ponto de partida e
                ajuste os tokens abaixo.
              </p>
            </div>
          </div>
          <Badge
            variant={uiTheme.presetId ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {uiTheme.name}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={uiTheme.presetId === preset.id}
              onSelect={() => selectPreset(preset.id)}
            />
          ))}
        </div>
      </section>

      <details className="group rounded-2xl border border-border/80 bg-card/30 shadow-2xs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </span>
            <span className="block">
              <span className="block text-sm font-semibold tracking-tight text-foreground">
                Personalizar tema e cores
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Abra para editar os tokens shadcn/ui da paleta clara e escura.
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
              shadcn/ui
            </Badge>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="border-t border-border/60 px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">
                Paleta em edição
              </p>
              <p className="text-[11px] text-muted-foreground">
                As mudanças são aplicadas na hora.
              </p>
            </div>

            <div className="flex rounded-lg border border-border/70 bg-background p-0.5">
              {(
                [
                  { id: "light" as UiThemeMode, label: "Claro", icon: Sun },
                  { id: "dark" as UiThemeMode, label: "Escuro", icon: Moon },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = paletteMode === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPaletteMode(item.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {coreTokens.map((token) => (
              <ColorField
                key={token.key}
                label={token.label}
                value={palette[token.key]}
                backdrop={palette.background}
                onChange={(value) => setToken(paletteMode, token.key, value)}
              />
            ))}
          </div>

          <details className="group mt-3 rounded-xl border border-border/70 bg-muted/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                Tokens avançados
                <span className="text-muted-foreground">
                  ({advancedTokens.length})
                </span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-2.5 border-t border-border/60 p-3 sm:grid-cols-2">
              {advancedTokens.map((token) => (
                <ColorField
                  key={token.key}
                  label={token.label}
                  value={palette[token.key]}
                  backdrop={palette.background}
                  onChange={(value) => setToken(paletteMode, token.key, value)}
                />
              ))}
            </div>
          </details>

          <div className="mt-3 rounded-xl border border-border/70 bg-card/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="ui-theme-radius"
                className="text-xs font-medium text-foreground"
              >
                Arredondamento
              </label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatRadius(radiusValue)}rem
              </span>
            </div>
            <input
              id="ui-theme-radius"
              type="range"
              min={0}
              max={1.5}
              step={0.125}
              value={radiusValue}
              onChange={(event) => setRadius(`${Number(event.target.value)}rem`)}
              className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Reto</span>
              <span>Arredondado</span>
            </div>
          </div>

          <div className="mt-4">
            <ThemePreview theme={uiTheme} mode={paletteMode} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleImport()}
            >
              <Upload className="size-3.5" />
              Importar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportUiThemeJson(uiTheme)}
            >
              <Download className="size-3.5" />
              Exportar JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportUiThemeCss(uiTheme)}
            >
              <FileCode2 className="size-3.5" />
              Exportar CSS
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground sm:ml-auto"
            >
              <RotateCcw className="size-3.5" />
              Restaurar padrão
            </Button>
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Aceita arquivos JSON ou CSS com os tokens shadcn/ui. A importação
            preserva o tema padrão nos tokens ausentes. As telas de projeção não
            são afetadas.
          </p>
        </div>
      </details>
    </div>
  );
}
