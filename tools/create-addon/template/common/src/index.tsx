import './addon.css';

import { defineAddon } from '@oakestra/dashboard-sdk';
import { PuzzleIcon } from 'lucide-react';
import { ADDON_ID } from 'virtual:oakestra-addon';

import { ClustersPage } from './pages/ClustersPage';
import { ClustersWidget } from './widgets/ClustersWidget';

export default defineAddon({
  id: ADDON_ID,
  // First breadcrumb of the addon's pages.
  label: '__LABEL__',
  routes: [{ index: true, crumb: 'Clusters', Component: ClustersPage }],
  contributions: {
    'nav.items': [{ id: 'main', label: '__LABEL__', path: '', icon: PuzzleIcon }],
    'home.widgets': [{ id: 'clusters', title: '__LABEL__', component: ClustersWidget }],
    // In the "Find or run anything" palette, see CommandAction and CommandSource in the SDK:
    // 'command.actions': [{ id: 'open', label: 'Open __LABEL__', path: '' }],
  },
});
