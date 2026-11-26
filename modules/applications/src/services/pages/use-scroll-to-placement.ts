import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

export const PLACEMENT_SECTION_ID = 'placement';

/**
 * Brings the placement explanation into view for a link ending in `#placement` (the Unplaced card
 * of the board). The browser's own hash scrolling cannot do it: the page is lazy and its data
 * arrives later, so the element does not exist when the navigation settles.
 *
 * `ready` is true while the section is in the DOM. The jump happens once per navigation
 * (`location.key`), so the poll of a transitional service never pulls the page back, and not at all
 * once the user has scrolled or pressed a key. `scrollIntoView` finds the shell's scrolling panel
 * by itself, and an instant jump is also what reduced motion asks for.
 */
export function useScrollToPlacement(ready: boolean) {
  const { hash, key } = useLocation();
  const done = useRef<string | null>(null);
  const interacted = useRef(false);
  const wanted = hash === `#${PLACEMENT_SECTION_ID}`;

  useEffect(() => {
    if (!wanted) return;
    interacted.current = false;
    const mark = () => {
      interacted.current = true;
    };
    // Not `scroll`: our own jump fires it too.
    const events = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const;
    for (const type of events) window.addEventListener(type, mark, { passive: true });
    return () => {
      for (const type of events) window.removeEventListener(type, mark);
    };
  }, [wanted, key]);

  useEffect(() => {
    if (!wanted || !ready || done.current === key || interacted.current) return;
    const section = document.getElementById(PLACEMENT_SECTION_ID);
    if (!section) return;
    done.current = key;
    section.scrollIntoView({ block: 'start' });
  }, [wanted, ready, key]);
}
