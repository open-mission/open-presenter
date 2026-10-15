import { create } from "zustand";
import type { StageMessage } from "@/core/types";

interface StageDisplayState {
  messages: StageMessage[];
  pushMessage(message: StageMessage): void;
  dismissMessage(id: string): void;
  clearMessages(): void;
}

export const useStageDisplayStore = create<StageDisplayState>((set) => ({
  messages: [],
  pushMessage: (message) =>
    set((s) => ({ messages: [...s.messages.slice(-19), message] })),
  dismissMessage: (id) =>
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  clearMessages: () => set({ messages: [] }),
}));
