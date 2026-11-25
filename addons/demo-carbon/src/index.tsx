import './addon.css';

import { defineAddon } from '@oakestra/dashboard-sdk';
import { LeafIcon } from 'lucide-react';
import { lazy } from 'react';
import { ADDON_ID } from 'virtual:oakestra-addon';

import { EnergyWidget, FootprintWidget } from './widgets/Widgets';

const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const MethodologyPage = lazy(() =>
  import('./pages/MethodologyPage').then((m) => ({ default: m.MethodologyPage })),
);

export default defineAddon({
  id: ADDON_ID,
  // First breadcrumb of the addon's pages.
  label: 'Carbon & Energy',
  routes: [
    { index: true, Component: OverviewPage },
    { path: 'methodology', crumb: 'Methodology', Component: MethodologyPage },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'main',
        label: 'Carbon & Energy',
        path: '',
        icon: LeafIcon,
        children: [
          { id: 'overview', label: 'Overview', path: '', order: 10 },
          { id: 'methodology', label: 'Methodology', path: 'methodology', order: 20 },
        ],
      },
    ],
    'home.widgets': [
      { id: 'footprint', title: 'Carbon footprint', size: 'card', component: FootprintWidget },
    ],
    'cluster.widgets': [{ id: 'energy', title: 'Energy', component: EnergyWidget }],
    'command.actions': [{ id: 'open', label: 'Show carbon footprint', path: '' }],
  },
});
