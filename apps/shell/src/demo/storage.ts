/**
 * Every key the demo stores starts with this prefix. It doubles as the marker that
 * `scripts/assert-prod-bundle.mjs` looks for: if it shows up in `dist/`, demo code leaked into a
 * production build.
 */
export const DEMO_STORAGE_PREFIX = 'oakestra-demo.';

export const TOUR_SEEN_KEY = `${DEMO_STORAGE_PREFIX}tour-seen`;

// Storage can throw (private windows, blocked site data). The demo must still work without it,
// at worst the tour starts again on the next visit.
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, 'true');
  } catch {
    // See readFlag.
  }
}
