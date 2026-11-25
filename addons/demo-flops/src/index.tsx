import './addon.css';

import { defineAddon } from '@oakestra/dashboard-sdk';
import { BrainCircuitIcon } from 'lucide-react';
import { ADDON_ID } from 'virtual:oakestra-addon';

import { ProjectCrumb, ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { searchProjects } from './search';
import { ApplicationTab } from './widgets/ApplicationTab';
import { TrainingWidget } from './widgets/TrainingWidget';

export default defineAddon({
  id: ADDON_ID,
  // First breadcrumb of the addon's pages.
  label: 'FLOps',
  routes: [
    { index: true, Component: ProjectsPage },
    { path: 'projects/:projectId', crumb: ProjectCrumb, Component: ProjectDetailPage },
    // `roles` on the nav sub-item only hides the link; this keeps a typed URL out as well.
    { path: 'settings', crumb: 'Settings', roles: ['Admin'], Component: SettingsPage },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'main',
        label: 'FLOps',
        path: '',
        icon: BrainCircuitIcon,
        children: [
          { id: 'projects', label: 'Projects', path: '' },
          { id: 'settings', label: 'Settings', path: 'settings', roles: ['Admin'] },
        ],
      },
    ],
    'application.detail.tabs': [
      { id: 'federated', label: 'Federated learning', component: ApplicationTab },
    ],
    'home.widgets': [
      { id: 'training', title: 'Federated learning', size: 'card', component: TrainingWidget },
    ],
    'command.sources': [{ id: 'projects', label: 'FL projects', search: searchProjects }],
    'command.actions': [{ id: 'open', label: 'Open federated learning projects', path: '' }],
  },
});
