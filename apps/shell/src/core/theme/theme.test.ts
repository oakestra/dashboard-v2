import { describe, expect, it } from 'vitest';

import { createThemeStore, THEME_STORAGE_KEY, watchThemeInOtherTabs } from './theme';

function fakeMedia(matches: boolean) {
  const listeners: (() => void)[] = [];
  const media = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
  } as unknown as MediaQueryList;
  return {
    matchMedia: () => media,
    setDark(next: boolean) {
      (media as { matches: boolean }).matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('theme store', () => {
  const root = document.documentElement;

  it('follows the OS in system mode and toggles .dark on <html>', () => {
    const media = fakeMedia(true);
    const store = createThemeStore({
      storage: window.localStorage,
      matchMedia: media.matchMedia,
      root,
    });
    expect(store.getState()).toMatchObject({ preference: 'system', resolved: 'dark' });
    expect(root).toHaveClass('dark');

    media.setDark(false);
    expect(root).not.toHaveClass('dark');
  });

  it('persists an explicit choice', () => {
    const media = fakeMedia(false);
    const store = createThemeStore({
      storage: window.localStorage,
      matchMedia: media.matchMedia,
      root,
    });
    store.getState().setPreference('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(root).toHaveClass('dark');
    expect(root.style.colorScheme).toBe('dark');

    media.setDark(false);
    expect(root).toHaveClass('dark');

    const reloaded = createThemeStore({
      storage: window.localStorage,
      matchMedia: media.matchMedia,
      root,
    });
    expect(reloaded.getState().preference).toBe('dark');
  });

  it('picks up changes made in other tabs and ignores garbage', () => {
    const media = fakeMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    const store = createThemeStore({
      storage: window.localStorage,
      matchMedia: media.matchMedia,
      root,
    });
    expect(store.getState().preference).toBe('system');

    const stop = watchThemeInOtherTabs(store, window.localStorage, window);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    expect(store.getState().resolved).toBe('dark');
    stop();
  });
});
