import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

// Long enough for a lazy route and cached data to render, short enough not to fight the user.
const RESTORE_FRAMES = 60;

/**
 * Page scroll for the panel the pages scroll in. The browser and react-router only manage the
 * window, so without this a new page opens at the previous page's offset and Back loses its place.
 *
 * Keyed on the path: search params hold page state (filters, the fleet inspector), and changing
 * those must not move the page.
 */
export function usePageScroll(): RefObject<HTMLElement | null> {
  const panel = useRef<HTMLElement>(null);
  const { key, pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const remember = () => positions.current.set(key, element.scrollTop);
    element.addEventListener('scroll', remember, { passive: true });
    return () => element.removeEventListener('scroll', remember);
  }, [key]);

  const previousPath = useRef(pathname);
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const element = panel.current;
    if (!element || hash) return;

    if (navigationType !== NavigationType.Pop) {
      element.scrollTop = 0;
      // Below the md breakpoint the panel does not scroll, the window does.
      document.documentElement.scrollTop = 0;
      return;
    }

    const target = positions.current.get(key) ?? 0;
    let frames = 0;
    let frame = 0;
    const restore = () => {
      element.scrollTop = target;
      // The page may still be too short to reach the offset while its content loads.
      if (element.scrollTop < target && ++frames < RESTORE_FRAMES) {
        frame = requestAnimationFrame(restore);
      }
    };
    restore();
    const stop = () => cancelAnimationFrame(frame);
    element.addEventListener('wheel', stop, { once: true, passive: true });
    element.addEventListener('touchstart', stop, { once: true, passive: true });
    return () => {
      stop();
      element.removeEventListener('wheel', stop);
      element.removeEventListener('touchstart', stop);
    };
  }, [pathname, hash, key, navigationType]);

  return panel;
}
