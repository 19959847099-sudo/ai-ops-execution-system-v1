import { create } from 'zustand';
import type { AppBootstrapSnapshot } from '@shared/types/app';

type AppShellState = {
  isLoading: boolean;
  error: string | null;
  snapshot: AppBootstrapSnapshot | null;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setSnapshot: (snapshot: AppBootstrapSnapshot) => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  isLoading: true,
  error: null,
  snapshot: null,
  setLoading: (value) => set({ isLoading: value }),
  setError: (value) => set({ error: value }),
  setSnapshot: (snapshot) => set({ snapshot, error: null }),
}));
