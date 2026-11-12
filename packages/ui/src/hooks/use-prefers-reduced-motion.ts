import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// jsdom and some embedded browsers have no matchMedia; treat that as "no preference".
const mediaQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : undefined;

function subscribe(onChange: () => void) {
  const query = mediaQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/**
 * Whether the user asked the OS for less motion. For motion that CSS cannot switch off by itself
 * (`motion-reduce:` covers class-based animation), such as animated SVG edges or camera moves.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? false,
    () => false,
  );
}
