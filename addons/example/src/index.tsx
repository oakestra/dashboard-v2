import './addon.css';

import { defineAddon } from '@oakestra/dashboard-sdk';
import { FlaskConicalIcon } from 'lucide-react';

import { DetailsPage } from './pages/DetailsPage';
import { ExamplePage } from './pages/ExamplePage';
import {
  ApplicationTab,
  ClusterWidget,
  HelloWidget,
  ServiceTab,
  SettingsPanel,
  ThrowingWidget,
} from './widgets/widgets';

export default defineAddon({
  id: 'example',
  routes: [
    { index: true, Component: ExamplePage },
    { path: 'details/:itemId', Component: DetailsPage },
  ],
  contributions: {
    'nav.items': [{ id: 'main', label: 'Example', path: '', icon: FlaskConicalIcon }],
    'home.widgets': [
      { id: 'hello', title: 'Example addon', component: HelloWidget, order: 10 },
      { id: 'throwing', title: 'Crash test', component: ThrowingWidget, order: 20 },
    ],
    'application.detail.tabs': [{ id: 'tab', label: 'Example', component: ApplicationTab }],
    'service.detail.tabs': [{ id: 'tab', label: 'Example', component: ServiceTab }],
    'cluster.widgets': [{ id: 'cluster', title: 'Example', component: ClusterWidget }],
    'settings.panels': [
      {
        id: 'settings',
        title: 'Example addon',
        component: SettingsPanel,
        roles: ['Admin'],
      },
    ],
  },
});
