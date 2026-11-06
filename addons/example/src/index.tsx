import './addon.css';

import { defineAddon, type CommandSource } from '@oakestra/dashboard-sdk';
import { FlaskConicalIcon } from 'lucide-react';
import { ADDON_ID } from 'virtual:oakestra-addon';

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

const SAMPLE_ITEMS = ['Alpha', 'Beta', 'Gamma'];

// Real sources read through `ctx.queryClient`, see the `search` documentation.
const searchSamples: CommandSource['search'] = (query, { addon }) =>
  Promise.resolve(
    addon
      ? SAMPLE_ITEMS.map((item) => ({
          id: item,
          label: `Sample ${item}`,
          description: 'Example item',
          path: addon.path('details', item),
        })).filter(({ label }) => label.toLowerCase().includes(query.toLowerCase()))
      : [],
  );

export default defineAddon({
  id: ADDON_ID,
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
    'command.actions': [
      {
        id: 'greet',
        label: 'Say hello from the example addon',
        keywords: ['greeting'],
        run: (ctx) => ctx.notify.success(`Hello from the palette, ${ctx.user.username}`),
      },
    ],
    'command.sources': [{ id: 'samples', label: 'Example items', search: searchSamples }],
  },
});
