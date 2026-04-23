'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WorkbenchState = {
  recentItems: string[];
  favorites: string[];
  addRecentItem: (value: string) => void;
  addFavorite: (value: string) => void;
};

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set, get) => ({
      recentItems: [],
      favorites: [],
      addRecentItem: (value) => {
        const next = [value, ...get().recentItems.filter((item) => item !== value)].slice(0, 10);
        set({ recentItems: next });
      },
      addFavorite: (value) => {
        const next = [value, ...get().favorites.filter((item) => item !== value)].slice(0, 20);
        set({ favorites: next });
      },
    }),
    {
      name: 'chaindev-workbench',
    },
  ),
);
