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
    ['addons/example/src/x.ts', "import '@oakestra/ui/theme.css';"],
    ['addons/example/src/x.ts', "import { ExamplePage } from './pages/ExamplePage';"],
    ['addons/example/src/x.ts', "import type { Paths } from '@oakestra/api';"],
    ['apps/shell/src/features/other/x.ts', "import { overviewModule } from '../overview';"],
    [
      'apps/shell/src/features/overview/x.ts',
      "import { OverviewPage } from './pages/OverviewPage';",
    ],
    ['apps/shell/src/app/x.ts', "import { overviewModule } from '../features/overview';"],
    ['apps/shell/src/features/other/x.ts', "import { userKeys } from '../users/keys';"],
    ['apps/shell/src/core/x.ts', "import { Slot } from './extensions/Slot';"],
    ['apps/shell/src/features/overview/x.ts', "import { formatBytes } from '../../lib/format';"],
    [
      'apps/shell/src/features/overview/x.ts',
      "import { JsonViewer } from '../../components/JsonViewer';",
    ],
    ['apps/shell/src/components/x.ts', "import { notify } from '../core/notify/notify';"],
    ['apps/shell/src/app/x.ts', "import { formatBytes } from '../lib/format';"],
    ['apps/shell/src/features/overview/x.ts', "import { createOakestraApi } from '@oakestra/api';"],
    ['apps/shell/src/features/overview/x.test.ts', "import { http } from '@oakestra/mocks';"],
    ['apps/shell/src/test/x.ts', "import { createMockServer } from '@oakestra/mocks/node';"],
    ['apps/shell/src/mock-api.ts', "import { startMockWorker } from '@oakestra/mocks/browser';"],
    ['packages/mocks/src/x.ts', "import { slaV2Schema } from '@oakestra/api';"],
    ['packages/dashboard-sdk/src/x.ts', "import type { OakestraEndpoints } from '@oakestra/api';"],
    ['tools/mock-system-manager/src/x.ts', "import { createHandlers } from '@oakestra/mocks';"],
  ])('allows %s: %s', async (file, code) => {
    expect(await violations(file, code)).toEqual([]);
  });

  it.each([
    [
      'apps/shell/src/components/x.ts',
      "import { overviewModule } from '../features/overview';",
      'boundaries/dependencies',
    ],
    [
      'apps/shell/src/core/x.ts',
      "import { formatBytes } from '../lib/format';",
      'boundaries/dependencies',
    ],
    [
      'addons/example/src/x.ts',
      "import { Slot } from '../../../apps/shell/src/core/extensions/Slot';",
      'boundaries/dependencies',
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
      "import { allUsersQuery } from '../users/api/queries';",
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
