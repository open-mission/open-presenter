export type PreferencesTab =
  | "appearance"
  | "outputs"
  | "stage"
  | "themes"
  | "general";

export interface TabDefinition {
  id: PreferencesTab;
  label: string;
  breadcrumb: string;
  description: string;
}
