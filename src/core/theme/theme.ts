export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "open_presenter_theme";

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export function getResolvedTheme(mode: ThemeMode = getStoredTheme()): "light" | "dark" {
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage might be unavailable or disabled
  }

  const root = document.documentElement;
  const isDark = getResolvedTheme(mode) === "dark";

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Manage system media query listener
  if (window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    if (mediaQueryListener) {
      mql.removeEventListener("change", mediaQueryListener);
      mediaQueryListener = null;
    }

    if (mode === "system") {
      mediaQueryListener = (e: MediaQueryListEvent) => {
        if (getStoredTheme() === "system") {
          if (e.matches) {
            root.classList.add("dark");
          } else {
            root.classList.remove("dark");
          }
        }
      };
      mql.addEventListener("change", mediaQueryListener);
    }
  }
}

export function initTheme(): void {
  const mode = getStoredTheme();
  applyTheme(mode);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        applyTheme(e.newValue as ThemeMode);
      }
    });
  }
}
