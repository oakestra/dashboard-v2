import './addon.css';

import { defineAddon } from '@oakestra/dashboard-sdk';
import { FlaskConicalIcon } from 'lucide-react';

import { AboutPage } from './pages/AboutPage';
import { DetailsPage } from './pages/DetailsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ExamplePage } from './pages/ExamplePage';
import {
  ApplicationTab,
  ClusterWidget,
  HelloWidget,
  ServiceTab,
  ThrowingWidget,
} from './widgets/widgets';

export default defineAddon({
  id: 'example',
  label: 'Example',
  routes: [
    { index: true, Component: ExamplePage },
    { path: 'details/:itemId', crumb: 'Details', Component: DetailsPage },
    { path: 'about', crumb: 'About', Component: AboutPage },
    // `roles` on the nav sub-item below only hides the link; this keeps a typed URL out as well.
    { path: 'settings', crumb: 'Settings', roles: ['Admin'], Component: SettingsPage },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'main',
        label: 'Example',
        path: '',
        icon: FlaskConicalIcon,
        children: [
          { id: 'overview', label: 'Overview', path: '' },
          { id: 'settings', label: 'Settings', path: 'settings', roles: ['Admin'] },
          { id: 'about', label: 'About', path: 'about' },
        ],
      },
    ],
    'home.widgets': [
      { id: 'hello', title: 'Example addon', component: HelloWidget, order: 10 },
      { id: 'throwing', title: 'Crash test', component: ThrowingWidget, order: 20 },
    ],
    'application.detail.tabs': [{ id: 'tab', label: 'Example', component: ApplicationTab }],
    'service.detail.tabs': [{ id: 'tab', label: 'Example', component: ServiceTab }],
    'cluster.widgets': [{ id: 'cluster', title: 'Example', component: ClusterWidget }],
  },
});
