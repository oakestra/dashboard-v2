import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import { importBoundaries } from './index.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

const eslint = new ESLint({
  cwd: rootDir,
  overrideConfigFile: true,
  overrideConfig: [tseslint.configs.base, ...importBoundaries({ rootDir })],
});

/** Lints `code` as if it lived at `filePath` (which does not need to exist) and returns rule ids. */
async function violations(filePath, code) {
  const [result] = await eslint.lintText(code, { filePath: `${rootDir}/${filePath}` });
  return result.messages.map((message) => message.ruleId ?? message.message);
}

describe('import boundaries', () => {
  it.each([
    ['addons/example/src/x.ts', "import { defineAddon } from '@oakestra/dashboard-sdk';"],
    ['addons/example/src/x.ts', "import { Button } from '@oakestra/ui';"],
    [
      'addons/example/src/widgets/x.test.tsx',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
    ],
    ['addons/example/src/x.ts', "import '@oakestra/ui/theme.css';"],
    [
      'addons/example/vite.config.ts',
      "import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';",
    ],
    [
      'addons/example/vitest.config.ts',
      "import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';",
    ],
    [
      'addons/example/vite.config.ts',
      "import { sharedDeps } from '@oakestra/dashboard-sdk/federation';",
    ],
    ['addons/example/src/x.ts', "import { ADDON_ID } from 'virtual:oakestra-addon';"],
    ['addons/example/src/x.ts', "import { ExamplePage } from './pages/ExamplePage';"],
    ['addons/example/src/x.ts', "import type { Paths } from '@oakestra/api';"],
    ['apps/shell/src/features/other/x.ts', "import { overviewModule } from '../overview';"],
    [
      'apps/shell/src/features/overview/x.ts',
      "import { OverviewPage } from './pages/OverviewPage';",
    ],
    ['apps/shell/src/app/x.ts', "import { overviewModule } from '../features/overview';"],
    ['apps/shell/src/features/other/x.ts', "import { appKeys } from '../applications/keys';"],
    ['apps/shell/src/core/x.ts', "import { Slot } from './extensions/Slot';"],
    [
      'apps/shell/src/features/overview/x.ts',
      "import { formatIssue } from '../../lib/zod-issues';",
    ],
    [
      'apps/shell/src/features/overview/x.ts',
      "import { OakestraLogo } from '../../components/OakestraLogo';",
    ],
    ['apps/shell/src/components/x.ts', "import { notify } from '../core/notify/notify';"],
    ['apps/shell/src/app/x.ts', "import { formatIssue } from '../lib/zod-issues';"],
    ['apps/shell/src/features/overview/x.ts', "import { createOakestraApi } from '@oakestra/api';"],
    ['apps/shell/src/features/overview/x.test.ts', "import { http } from '@oakestra/mocks';"],
    ['apps/shell/src/test/x.ts', "import { createMockServer } from '@oakestra/mocks/node';"],
    ['apps/shell/src/mock-api.ts', "import { startMockWorker } from '@oakestra/mocks/browser';"],
    ['packages/mocks/src/x.ts', "import { slaV2Schema } from '@oakestra/api';"],
    ['packages/dashboard-sdk/src/x.ts', "import type { OakestraEndpoints } from '@oakestra/api';"],
    ['tools/mock-system-manager/src/x.ts', "import { createHandlers } from '@oakestra/mocks';"],
    ['modules/help/src/x.ts', "import { defineAddon } from '@oakestra/dashboard-sdk';"],
    ['modules/help/src/x.ts', "import { Button } from '@oakestra/ui';"],
    ['modules/help/src/x.ts', "import { DataTable } from '@oakestra/ui/data-table';"],
    ['modules/help/src/x.ts', "import type { Cluster } from '@oakestra/api';"],
    ['modules/help/src/x.ts', "import { parseClusterLocation } from '@oakestra/api';"],
    ['modules/help/src/x.ts', "import { HelpPage } from './pages/HelpPage';"],
    [
      'modules/help/src/pages/x.test.tsx',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
    ],
    ['apps/shell/src/app/modules.ts', "import help from '@oakestra/module-help';"],
    ['apps/shell/src/linked/help.test.tsx', "import help from '@oakestra/module-help';"],
    ['apps/shell/src/linked/help.test.tsx', "import { renderApp } from '../test/render';"],
    ['apps/shell/src/linked/help.test.tsx', "import { linkedAddons } from '../app/modules';"],
    ['apps/shell/src/linked/help.test.tsx', "import { http } from '@oakestra/mocks';"],
  ])('allows %s: %s', async (file, code) => {
    expect(await violations(file, code)).toEqual([]);
  });

  it.each([
    [
      'modules/help/src/x.ts',
      "import { Slot } from '../../../apps/shell/src/core/extensions/Slot';",
      'boundaries/dependencies',
    ],
    [
      'modules/help/src/x.ts',
      "import example from '../../../addons/example/src/index';",
      'boundaries/dependencies',
    ],
    [
      'modules/help/src/x.ts',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'modules/help/src/x.ts',
      "import { createOakestraApi } from '@oakestra/api';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'modules/help/src/x.ts',
      "import { http } from '@oakestra/mocks';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'modules/help/src/x.ts',
      "import '@oakestra/ui/theme.css';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'modules/help/src/x.ts',
      "import { ADDON_ID } from 'virtual:oakestra-addon';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'apps/shell/src/features/overview/x.ts',
      "import help from '@oakestra/module-help';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/core/x.ts',
      "import help from '@oakestra/module-help';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/components/x.ts',
      "import { overviewModule } from '../features/overview';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/core/x.ts',
      "import { formatIssue } from '../lib/zod-issues';",
      'boundaries/dependencies',
    ],
    [
      'addons/example/src/x.ts',
      "import { Slot } from '../../../apps/shell/src/core/extensions/Slot';",
      'boundaries/dependencies',
    ],
    [
      'addons/example/src/x.ts',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/src/x.tsx',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'apps/shell/src/features/overview/x.ts',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
      'no-restricted-imports',
    ],
    [
      'addons/example/src/x.ts',
      "import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/src/x.test.ts',
      "import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/vite.config.ts',
      "import { createConfig } from '@oakestra/eslint-config';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/vite.config.ts',
      "import { renderInHost } from '@oakestra/dashboard-sdk/testing';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/src/x.test.ts',
      "import { createConfig } from '@oakestra/eslint-config';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/src/x.ts',
      "import { createConfig } from '@oakestra/eslint-config';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/src/x.ts',
      "import { cn } from '@oakestra/ui/src/lib/utils';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'addons/example/src/x.ts',
      "import { createOakestraApi } from '@oakestra/api';",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'packages/ui/src/x.ts',
      "import { useNotify } from '@oakestra/dashboard-sdk';",
      'no-restricted-imports',
    ],
    [
      'packages/ui/src/x.ts',
      "import { SDK_VERSION } from '../../dashboard-sdk/src/version';",
      'boundaries/dependencies',
    ],
    [
      'packages/dashboard-sdk/src/x.ts',
      "import { Button } from '../../ui/src/components/button';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/features/other/x.ts',
      "import { OverviewPage } from '../overview/pages/OverviewPage';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/features/other/x.ts',
      "import { profileQuery } from '../profile/api/queries';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/core/x.ts',
      "import { overviewModule } from '../features/overview';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/features/overview/pages/OverviewPage.tsx',
      "import { http } from '@oakestra/mocks';",
      'no-restricted-imports',
    ],
    [
      'apps/shell/src/core/api/x.ts',
      "import { createMockServer } from '@oakestra/mocks/node';",
      'no-restricted-imports',
    ],
    [
      'apps/shell/src/app/layouts/AppLayout.tsx',
      "import { renderApp } from '../../test/render';",
      'no-restricted-imports',
    ],
    [
      'packages/api/src/x.ts',
      "import { createHandlers } from '../../mocks/src/handlers';",
      'boundaries/dependencies',
    ],
  ])('rejects %s: %s', async (file, code, rule) => {
    expect(await violations(file, code)).toContain(rule);
  });
});
