import type {
  CommunicationAlert,
  CommunicationDisplayMode,
  CommunicationLevel,
  CommunicationTarget,
} from "../../core/types/index.ts";

export type {
  CommunicationAlert,
  CommunicationDisplayMode,
  CommunicationLevel,
  CommunicationTarget,
};

export interface QuickPreset {
  id: string;
  label: string;
  text: string;
  level: CommunicationLevel;
  displayMode: CommunicationDisplayMode;
  targets: CommunicationTarget[];
  scroll?: boolean;
}
