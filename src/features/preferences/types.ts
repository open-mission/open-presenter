export type PreferencesTab =
  | "appearance"
  | "outputs"
  | "themes"
  | "songs"
  | "general"
  | "remote"
  | "updates";

export type OutputsSection = "public" | "stage" | "stream" | "server" | "devices";

export interface TabDefinition {
  id: PreferencesTab;
  label: string;
  breadcrumb: string;
  description: string;
}
