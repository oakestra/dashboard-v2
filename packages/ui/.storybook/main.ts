import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  // Stories live outside src/ on purpose: styles.css scans src/components for class names, so
  // utilities used only by story layouts would otherwise end up in the shell's production CSS.
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  typescript: {
    // react-docgen cannot follow the cva VariantProps types; the TypeScript-based one can, so the
    // controls panel lists `variant` and `size` options.
    reactDocgen: 'react-docgen-typescript',
  },
  // packages/ui has no vite.config of its own (it ships source), so the plugins the shell uses for
  // these components are added here.
  viteFinal: (viteConfig) => mergeConfig(viteConfig, { plugins: [react(), tailwindcss()] }),
};

export default config;
