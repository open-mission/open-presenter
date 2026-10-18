import {
  Monitor,
  Music,
  Palette,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { PreferencesTab } from "./types";

export interface NavItemConfig {
  id: PreferencesTab;
  label: string;
  breadcrumb: string;
  icon: LucideIcon;
}

export const PREFERENCES_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "general",
    label: "Geral",
    breadcrumb: "Geral & Atalhos",
    icon: SlidersHorizontal,
  },
  {
    id: "outputs",
    label: "Saídas",
    breadcrumb: "Saídas",
    icon: Monitor,
  },
  {
    id: "themes",
    label: "Temas",
    breadcrumb: "Temas",
    icon: Sparkles,
  },
  {
    id: "songs",
    label: "Músicas",
    breadcrumb: "Músicas & Grupos",
    icon: Music,
  },
  {
    id: "remote",
    label: "Controle Remoto",
    breadcrumb: "Controle Remoto",
    icon: Smartphone,
  },
  {
    id: "appearance",
    label: "Aparência",
    breadcrumb: "Aparência",
    icon: Palette,
  },
];
