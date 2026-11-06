import { useCurrentUser, useNotify } from '@oakestra/dashboard-sdk';
import { Button, Kbd } from '@oakestra/ui';
import { SearchIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { ErrorBoundary } from '../../core/extensions/ErrorBoundary';

const LABEL = 'Find or run anything';

const loadDialog = () => import('./command-palette/CommandPaletteDialog');

// Lazy because of cmdk: this file is on every page, the palette is opened on few of them.
const CommandPaletteDialog = lazy(() =>
  loadDialog().then((m) => ({ default: m.CommandPaletteDialog })),
);

const IS_MAC = /mac|iphone|ipad/i.test(navigator.platform);

function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'k'
  );
}

/**
 * The shortcut does nothing while another dialog is open: closing that one could lose what was
 * typed into it, and on top of it the palette would fight its focus trap. This covers the dialogs
 * of `@oakestra/ui`, which is what addons use too.
 */
function isModalOpen(): boolean {
  return (
    document.querySelector('[role="dialog"][data-state="open"]') !== null ||
    document.querySelector('[role="alertdialog"][data-state="open"]') !== null
  );
}

/** The "Find or run anything" bar in the header, and Mod+K from anywhere, inputs included. */
export function CommandPalette() {
  const user = useCurrentUser();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Something on the page claimed the key for itself.
      if (event.defaultPrevented || !isPaletteShortcut(event)) return;
      // Also when nothing opens: browsers would move focus to their search bar instead.
      event.preventDefault();
      if (event.repeat) return;
      setOpen((current) => (current ? false : !isModalOpen()));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={LABEL}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        // The first open would otherwise wait for the chunk with the palette already asked for.
        onPointerEnter={() => void loadDialog()}
        onFocus={() => void loadDialog()}
        className="text-muted-foreground size-8 px-0 md:w-60 md:justify-start md:px-2"
        data-testid="command-palette-trigger"
      >
        <SearchIcon aria-hidden />
        <span className="hidden font-normal md:inline">{LABEL}</span>
        <Kbd className="ml-auto hidden md:inline-flex">{IS_MAC ? '⌘K' : 'Ctrl K'}</Kbd>
      </Button>
      {open && user ? (
        // Without this a failed chunk download would take the page down with it, and it is not
        // worth more than a toast: everything in the palette is also reachable from the sidebar.
        <ErrorBoundary
          fallback={() => null}
          onError={(error) => {
            close();
            notify.error('Could not open the command palette', { description: error.message });
          }}
        >
          {/* Outside the dialog: inside it, the dialog would mount empty, and focus the first thing
              it finds before the input exists. */}
          <Suspense fallback={null}>
            <CommandPaletteDialog user={user} onClose={close} />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </>
  );
}
