export type PreferencesTab =
  | "appearance"
  | "outputs"
  | "themes"
  | "songs"
  | "general"
  | "remote";

export type OutputsSection = "public" | "stage" | "server" | "devices";

export interface TabDefinition {
  id: PreferencesTab;
  label: string;
  breadcrumb: string;
  description: string;
}
