export type PreferencesTab =
  | "appearance"
  | "outputs"
  | "themes"
  | "general";

export type OutputsSection = "public" | "stage" | "server" | "devices";

export interface TabDefinition {
  id: PreferencesTab;
  label: string;
  breadcrumb: string;
  description: string;
}
