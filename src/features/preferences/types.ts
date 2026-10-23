export type PreferencesTab =
  | "appearance"
  | "outputs"
  | "themes"
  | "songs"
  | "general"
  | "remote"
  | "updates";

export type OutputsSection = "server" | "devices" | "wallpaper";

export interface TabDefinition {
  id: PreferencesTab;
  label: string;
  breadcrumb: string;
  description: string;
}
