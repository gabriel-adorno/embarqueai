import { create } from 'zustand';

import type { AppMessageKind } from '@/src/lib/messages';

export type FlashMessage = {
  title: string;
  body?: string;
  kind: AppMessageKind;
};

type ToastState = {
  flash: FlashMessage | null;
  show: (flash: FlashMessage) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  flash: null,
  show: (flash) => set({ flash }),
  hide: () => set({ flash: null }),
}));
