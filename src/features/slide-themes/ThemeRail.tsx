import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Palette,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { kindToAsset } from "@/core/types";
import { usePresentationStore } from "@/features/presentation/store";
import { useSlideThemesStore } from "./store";
import { ScaledStage } from "./ScaledStage";
import { cloneTheme, isPublicTheme, isStageCandidate, previewTheme } from "./pages";
import { DEFAULT_PUBLIC_THEME, DEFAULT_STAGE_THEME } from "./seedThemes";
import { SAMPLES } from "./samples";

const RAIL_KEY = "open_presenter_theme_rail_open";

interface MenuState {
  guid: string;
  x: number;
  y: number;
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) !== "false";
  } catch {
    return true;
  }
}

export function ThemeRail() {
  const navigate = useNavigate();
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
  const setStageTheme = useSlideThemesStore((s) => s.setStageTheme);
  const resolvedStageTheme = useSlideThemesStore((s) => s.resolveStageTheme());
  const load = useSlideThemesStore((s) => s.load);
  const save = useSlideThemesStore((s) => s.save);
  const setBinding = useSlideThemesStore((s) => s.setBinding);
  const remove = useSlideThemesStore((s) => s.remove);
  const liveKind = usePresentationStore((s) => s.live.content.kind);

  const [open, setOpen] = useState(readOpen);
  const [railTab, setRailTab] = useState<"public" | "stage">("public");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirmGuid, setConfirmGuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menu) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        setConfirmGuid(null);
      }
    }
    function onScroll() {
      setMenu(null);
      setConfirmGuid(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  function toggleOpen() {
    setOpen((v) => {
      try {
        localStorage.setItem(RAIL_KEY, String(!v));
      } catch {}
      return !v;
    });
  }

  const publicThemes = useMemo(() => {
    return themes.filter(isPublicTheme);
  }, [themes]);

  const stageThemes = useMemo(() => {
    return themes.filter(isStageCandidate);
  }, [themes]);

  const displayedThemes = railTab === "public" ? publicThemes : stageThemes;

  const effectiveKind = liveKind === "blank" ? "lyric" : liveKind;
  const asset = kindToAsset(liveKind) ?? "music";
  const liveGuid =
    railTab === "public"
      ? bindings.find((b) => b.target === "public" && b.asset === effectiveKind)?.themeGuid ?? null
      : resolvedStageTheme?.guid ?? stageThemeGuid ?? null;

  function apply(guid: string) {
    if (railTab === "stage") {
      setStageTheme(guid);
    } else {
      setBinding("public", effectiveKind, guid);
    }
  }

  function edit(guid: string) {
    navigate(`/theme-editor?guid=${guid}`);
  }

  async function handleRemove(guid: string) {
    if (confirmGuid !== guid) {
      setConfirmGuid(guid);
      return;
    }
    setConfirmGuid(null);
    setMenu(null);
    setError(null);
    try {
      await remove(guid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao excluir tema");
    }
  }

  function closeMenu() {
    setMenu(null);
    setConfirmGuid(null);
  }

  async function handleCreateTheme() {
    setError(null);
    try {
      if (railTab === "stage") {
        const theme = cloneTheme(
          DEFAULT_STAGE_THEME,
          `Novo Tema de Retorno ${stageThemes.length + 1}`,
        );
        theme.category = "stage";
        await save(theme);
        setStageTheme(theme.guid);
        navigate(`/theme-editor?guid=${theme.guid}`);
      } else {
        const theme = cloneTheme(
          DEFAULT_PUBLIC_THEME,
          `Novo Tema ${publicThemes.length + 1}`,
        );
        theme.category = "theme";
        await save(theme);
        navigate(`/theme-editor?guid=${theme.guid}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar tema");
    }
  }

  if (!open) {
    return (
      <aside
        aria-label="Trilho de temas"
        className="flex w-10 shrink-0 flex-col border-l border-border bg-card/40"
      >
        <div className="flex h-14 items-center justify-center border-b border-border bg-muted/20">
          <button
            type="button"
            aria-label="Expandir trilho de temas"
            title="Temas"
            onClick={toggleOpen}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Trilho de temas"
      className="flex w-44 shrink-0 flex-col border-l border-border bg-card/40"
    >
      <div className="flex h-14 items-center justify-between border-b border-border bg-muted/20 px-3">
        <div className="flex items-center gap-2">
          <Palette className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Temas</span>
        </div>
        <button
          type="button"
          aria-label="Recolher trilho de temas"
          onClick={toggleOpen}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Segmented Switch: Projeção vs Palco */}
      <div className="border-b border-border bg-muted/30 p-1.5">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/60 p-0.5 text-[11px] font-medium border border-border/40">
          <button
            type="button"
            className={`rounded py-1 text-center transition-colors cursor-pointer ${
              railTab === "public"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setRailTab("public")}
          >
            Projeção
          </button>
          <button
            type="button"
            className={`rounded py-1 text-center transition-colors cursor-pointer ${
              railTab === "stage"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setRailTab("stage")}
          >
            Palco
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <span>{railTab === "public" ? "Saída de telão" : "Retorno de palco"}</span>
          <button
            type="button"
            onClick={() => void handleCreateTheme()}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title={railTab === "public" ? "Criar novo tema de projeção" : "Criar novo tema de retorno"}
          >
            <Plus className="size-3" />
            Novo
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error !== null && (
          <p className="mb-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {displayedThemes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-3 text-center">
            <Palette className="size-5 text-muted-foreground/50" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {railTab === "stage"
                ? "Nenhum tema de palco encontrado. Crie um novo para o retorno."
                : "Nenhum tema criado ainda. Crie o primeiro para personalizar a projeção."}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-7 w-full gap-1.5 text-[11px] cursor-pointer"
              onClick={() => void handleCreateTheme()}
            >
              <Plus className="size-3.5" />
              {railTab === "stage" ? "Criar tema de retorno" : "Criar novo tema"}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {displayedThemes.map((theme) => {
              const isLive = theme.guid === liveGuid;
              const preview = previewTheme(theme, railTab === "stage" ? "rest" : asset);
              return (
                <li key={theme.guid}>
                  <button
                    type="button"
                    title={`${theme.title} (${isLive ? "Ativo" : "Clique ou dê dois cliques para aplicar"})`}
                    onClick={() => apply(theme.guid)}
                    onDoubleClick={() => apply(theme.guid)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setConfirmGuid(null);
                      setMenu({ guid: theme.guid, x: e.clientX, y: e.clientY });
                    }}
                    className={`group flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left cursor-pointer transition-all ${
                      isLive
                        ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                        : "border-border bg-card/60 hover:border-primary/50"
                    }`}
                  >
                    <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-black">
                      <ScaledStage
                        theme={preview.theme}
                        asset={preview.asset}
                        props={SAMPLES[preview.asset].props}
                      />
                      {isLive && (
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-primary px-1 py-px text-[9px] font-bold text-primary-foreground">
                          <Zap className="size-2.5" />
                          {railTab === "public" ? "No ar" : "Palco"}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {theme.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeMenu();
            }}
          />
          <div
            role="menu"
            className="fixed z-50 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            style={{
              left: Math.min(menu.x, window.innerWidth - 184),
              top: Math.min(menu.y, window.innerHeight - 140),
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const guid = menu.guid;
                closeMenu();
                edit(guid);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="size-3.5" />
              Editar
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const guid = menu.guid;
                closeMenu();
                apply(guid);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <Check className="size-3.5" />
              {railTab === "stage" ? "Definir para Palco" : "Aplicar"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleRemove(menu.guid)}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground ${
                confirmGuid === menu.guid
                  ? "text-destructive hover:text-destructive"
                  : ""
              }`}
            >
              <Trash2 className="size-3.5" />
              {confirmGuid === menu.guid
                ? "Clique para confirmar"
                : "Remover"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
