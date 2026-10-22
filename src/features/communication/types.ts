import type {
  CommunicationAlert,
  CommunicationDisplayMode,
  CommunicationLevel,
} from "../../core/types/index.ts";

export type {
  CommunicationAlert,
  CommunicationDisplayMode,
  CommunicationLevel,
};

export interface QuickPreset {
  id: string;
  label: string;
  text: string;
  level: CommunicationLevel;
  displayMode: CommunicationDisplayMode;
  scroll?: boolean;
}
