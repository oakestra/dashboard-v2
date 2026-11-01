import { createStore, type StoreApi } from 'zustand/vanilla';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'oakestra.theme';
const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
}

export type ThemeStore = StoreApi<ThemeState>;

interface ThemeEnvironment {
  storage: Storage;
  matchMedia: (query: string) => MediaQueryList;
  root: HTMLElement;
}

function readPreference(storage: Storage): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored as ThemePreference) ? (stored as ThemePreference) : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Light/dark/system theme. Applies `.dark` on <html> (the class the Tailwind `dark` variant and
 * the token values in @oakestra/ui key off), follows the OS setting in `system` mode, and syncs
 * between tabs.
 */
export function createThemeStore(env: ThemeEnvironment): ThemeStore {
  const media = env.matchMedia('(prefers-color-scheme: dark)');
  const resolve = (preference: ThemePreference): ResolvedTheme =>
    preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;

  const apply = (resolved: ResolvedTheme) => {
    env.root.classList.toggle('dark', resolved === 'dark');
    env.root.style.colorScheme = resolved;
  };

  const initial = readPreference(env.storage);
  const store = createStore<ThemeState>()((set) => ({
    preference: initial,
    resolved: resolve(initial),
    setPreference(preference) {
      try {
        env.storage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        // Not persisted, still applied for this page.
      }
      set({ preference, resolved: resolve(preference) });
    },
  }));

  apply(store.getState().resolved);
  store.subscribe((state) => apply(state.resolved));
  media.addEventListener('change', () => {
    const { preference } = store.getState();
    if (preference === 'system') store.setState({ resolved: resolve(preference) });
  });
  return store;
}

/** Keeps tabs in sync when the theme is changed in another one. */
export function watchThemeInOtherTabs(
  store: ThemeStore,
  storage: Storage,
  target: Window,
): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const preference = readPreference(storage);
    if (preference !== store.getState().preference) store.getState().setPreference(preference);
  };
  target.addEventListener('storage', onStorage);
  return () => target.removeEventListener('storage', onStorage);
}
