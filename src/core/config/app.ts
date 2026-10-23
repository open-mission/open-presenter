export const APP_NAME = "Open Presenter";

export const OUTPUT_HTTP_PORT = 5050;
export const WS_PATH = "/ws";

export const ROUTES = {
  admin: "/admin",
  public: "/public",
  stage: "/stage",
} as const;

export const TAURI_EVENTS = {
  slide: "presentation://slide",
  outputs: "outputs://changed",
  displays: "displays://changed",
  stageMessage: "stage://message",
  timer: "stage://timer",
  themes: "presentation://themes",
  themesChanged: "themes://changed",
  outputPlans: "presentation://output-plans",
  outputOverrides: "presentation://output-overrides",
  wallpaper: "presentation://wallpaper",
} as const;

export function outputHttpUrl(
  host: string,
  port: number,
  path: "/public" | "/stage" | "/stream" | string,
): string {
  return `http://${host}:${port}/#${path}`;
}

export function outputWsUrl(host: string, port: number): string {
  return `ws://${host}:${port}${WS_PATH}`;
}
