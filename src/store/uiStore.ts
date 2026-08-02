import { create } from "zustand";

interface UiPreviewState {
  readonly appLockEnabled: boolean;
  readonly remindersEnabled: boolean;
  readonly smartTipsEnabled: boolean;
  readonly setAppLockEnabled: (enabled: boolean) => void;
  readonly setRemindersEnabled: (enabled: boolean) => void;
  readonly setSmartTipsEnabled: (enabled: boolean) => void;
}

// Figma uses enabled switches; persistence and consent remain later product tasks.
export const useUiStore = create<UiPreviewState>((set) => ({
  appLockEnabled: true,
  remindersEnabled: true,
  smartTipsEnabled: true,
  setAppLockEnabled: (enabled) => set({ appLockEnabled: enabled }),
  setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
  setSmartTipsEnabled: (enabled) => set({ smartTipsEnabled: enabled }),
}));
