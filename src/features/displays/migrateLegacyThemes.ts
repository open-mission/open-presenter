import type { DisplayOutput } from "@/core/types";

const BINDINGS_KEY = "open_presenter_theme_bindings";
const STAGE_THEME_KEY = "open_presenter_stage_theme";
const STAGE_REST_THEME_KEY = "open_presenter_stage_rest_theme";

interface LegacyBinding {
  target?: string;
  asset?: string;
  themeGuid?: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Migra os bindings globais antigos (ThemeRail) para o tema padrão de cada
 * saída. Roda na leitura e é idempotente: só preenche campos vazios.
 */
export function migrateLegacyThemeBindings(outputs: DisplayOutput[]): {
  outputs: DisplayOutput[];
  changed: boolean;
} {
  const bindings = readJson<LegacyBinding[]>(BINDINGS_KEY) ?? [];
  const stageGuid = readString(STAGE_THEME_KEY);
  const stageRestGuid = readString(STAGE_REST_THEME_KEY);

  const bindingFor = (target: string): string | null => {
    const binding =
      bindings.find((b) => b.target === target && b.asset === "lyric") ??
      bindings.find((b) => b.target === target);
    return binding?.themeGuid ?? null;
  };

  let changed = false;
  const migrated = outputs.map((output) => {
    let next = output;

    if (!output.defaultThemeGuid) {
      const guid =
        output.category === "stage"
          ? stageGuid
          : output.category === "lower"
            ? bindingFor("stream")
            : bindingFor("public");
      if (guid) {
        next = { ...next, defaultThemeGuid: guid };
        changed = true;
      }
    }

    if (output.category === "stage" && !output.idleThemeGuid && stageRestGuid) {
      next = { ...next, idleThemeGuid: stageRestGuid };
      changed = true;
    }

    return next;
  });

  return { outputs: changed ? migrated : outputs, changed };
}
