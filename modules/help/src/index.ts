import { defineAddon } from '@oakestra/dashboard-sdk';
import { CircleHelpIcon } from 'lucide-react';
import { lazy } from 'react';

// Its own chunk: the shell bundles the package, but only the help page needs this code.
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));

export default defineAddon({
  id: 'help',
  // Also the breadcrumb of the page, so the index route needs no crumb of its own.
  label: 'Help',
  routes: [{ index: true, Component: HelpPage }],
  contributions: {
    'nav.items': [
      {
        id: 'help',
        label: 'Help',
        path: '',
        icon: CircleHelpIcon,
        group: 'footer',
        // Above Settings.
        order: 900,
      },
    ],
  },
});
