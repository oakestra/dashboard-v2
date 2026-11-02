import { createContext, useContext } from 'react';
import { useStore } from 'zustand';

import type { ThemeState, ThemeStore } from './theme';

export const ThemeContext = createContext<ThemeStore | null>(null);

export function useTheme(): ThemeState {
  const store = useContext(ThemeContext);
  if (!store) throw new Error('useTheme() must be used below <ThemeContext.Provider>');
  return useStore(store);
}
