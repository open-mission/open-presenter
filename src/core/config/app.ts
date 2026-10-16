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
  stageMessage: "stage://message",
  themes: "presentation://themes",
  themesChanged: "themes://changed",
} as const;

export function outputHttpUrl(host: string, path: "/public" | "/stage"): string {
  return `http://${host}:${OUTPUT_HTTP_PORT}/#${path}`;
}

export function outputWsUrl(host: string): string {
  return `ws://${host}:${OUTPUT_HTTP_PORT}${WS_PATH}`;
}
