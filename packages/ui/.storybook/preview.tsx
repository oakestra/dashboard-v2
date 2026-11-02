import './preview.css';

import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react-vite';
// Same setup as the shell's bootstrap.tsx: the map components need the worker URL registered
// before the first render.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

import { setMapWorkerUrl, Toaster, TooltipProvider } from '../src';

setMapWorkerUrl(maplibreWorkerUrl);

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // The canvas background comes from the theme tokens (body uses bg-background), so the
    // backgrounds toolbar would only fight the dark mode toggle.
    backgrounds: { disable: true },
    a11y: { test: 'todo' },
    options: {
      storySort: {
        order: [
          'Introduction',
          'Foundations',
          'Composites',
          'Actions',
          'Forms',
          'Data display',
          'Feedback',
          'Overlays',
          'Navigation',
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      // The shell mounts both once at the app root; components expect them to be there. The
      // Toaster gets the theme passed in, as in the shell, instead of following the OS setting.
      <TooltipProvider>
        <Story />
        <Toaster theme={context.globals.theme === 'dark' ? 'dark' : 'light'} />
      </TooltipProvider>
    ),
    // The tokens switch on the `.dark` class, like the shell's appearance setting.
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
};

export default preview;
