import { create } from "zustand";

export type AppViewTab = "presentation" | "songs" | "images" | "agenda" | "studio";

interface NavigationState {
  activeTab: AppViewTab;
  setActiveTab(tab: AppViewTab): void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeTab: "presentation",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
