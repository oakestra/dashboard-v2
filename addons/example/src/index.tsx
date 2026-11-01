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
  routes: [
    { index: true, Component: ExamplePage },
    { path: 'details/:itemId', Component: DetailsPage },
    { path: 'about', Component: AboutPage },
    { path: 'settings', Component: SettingsPage },
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
