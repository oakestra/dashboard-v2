import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architectural elements of the repository. Paths are relative to the repository root.
 * See AGENTS.md ("Import boundaries") for the reasoning behind each rule.
 */
const elements = [
  { type: 'shell-entry', pattern: 'apps/shell/src/*.{ts,tsx}' },
  { type: 'shell-app', pattern: 'apps/shell/src/app' },
  { type: 'shell-feature', pattern: 'apps/shell/src/features/*', capture: ['feature'] },
  { type: 'shell-core', pattern: 'apps/shell/src/core' },
  // Presentational components and helpers shared by several features; no feature knowledge.
  { type: 'shell-shared', pattern: ['apps/shell/src/components', 'apps/shell/src/lib'] },
  { type: 'shell-test', pattern: 'apps/shell/src/test' },
  { type: 'sdk', pattern: 'packages/dashboard-sdk' },
  { type: 'ui', pattern: 'packages/ui' },
  { type: 'api', pattern: 'packages/api' },
  { type: 'mocks', pattern: 'packages/mocks' },
  { type: 'addon', pattern: 'addons/*', capture: ['addon'] },
  { type: 'tool', pattern: 'tools/*', capture: ['tool'] },
  { type: 'e2e', pattern: 'e2e' },
];

const shellShared = ['sdk', 'ui', 'api'];

const policies = [
  // `mocks` only for src/mock-api.ts (dev:mock); no-restricted-imports keeps it out of the rest.
  {
    from: { element: { type: 'shell-entry' } },
    allow: {
      to: {
        element: {
          types: { anyOf: ['shell-entry', 'shell-app', 'shell-core', 'mocks', ...shellShared] },
        },
      },
    },
  },
  {
    from: { element: { type: 'shell-app' } },
    allow: {
      to: {
        element: {
          types: {
            anyOf: [
              'shell-app',
              'shell-core',
              'shell-shared',
              'shell-feature',
              'shell-test',
              ...shellShared,
            ],
          },
        },
      },
    },
  },
  // Core is the platform features build on; it must not depend on any feature. `mocks` is for
  // tests only, enforced by no-restricted-imports below.
  {
    from: { element: { type: 'shell-core' } },
    allow: {
      to: { element: { types: { anyOf: ['shell-core', 'shell-test', 'mocks', ...shellShared] } } },
    },
  },
  // The test helpers render the real app (providers, router, layouts) around what is tested.
  {
    from: { element: { type: 'shell-test' } },
    allow: {
      to: {
        element: { types: { anyOf: ['shell-core', 'shell-app', 'mocks', ...shellShared] } },
      },
    },
  },
  // Shared components sit between core and features: they may use the platform, not features.
  {
    from: { element: { type: 'shell-shared' } },
    allow: {
      to: { element: { types: { anyOf: ['shell-shared', 'shell-core', ...shellShared] } } },
    },
  },
  // Features may use core, shared components and their own files. Other features only through
  // their index.ts.
  {
    from: { element: { type: 'shell-feature' } },
    allow: {
      to: {
        element: {
          types: {
            anyOf: ['shell-core', 'shell-shared', 'shell-test', 'mocks', ...shellShared],
          },
        },
      },
    },
  },
  {
    from: { element: { type: 'shell-feature' } },
    allow: {
      to: {
        element: {
          type: 'shell-feature',
          captured: { feature: '{{ from.element.captured.feature }}' },
        },
      },
    },
  },
  {
    from: { element: { type: 'shell-feature' } },
    // `keys.ts` is a dependency-free leaf for query keys, so features that invalidate each
    // other's caches do not form an import cycle through each other's index.
    allow: {
      to: { element: { type: 'shell-feature', fileInternalPath: ['index.ts', 'keys.ts'] } },
    },
  },
  // The SDK is the public contract and the UI library is below it; neither may reach upwards.
  // The SDK types its API facade with @oakestra/api, which itself depends on nothing internal.
  {
    from: { element: { type: 'sdk' } },
    allow: { to: { element: { types: { anyOf: ['sdk', 'api'] } } } },
  },
  { from: { element: { type: 'ui' } }, allow: { to: { element: { type: 'ui' } } } },
  { from: { element: { type: 'api' } }, allow: { to: { element: { type: 'api' } } } },
  {
    from: { element: { type: 'mocks' } },
    allow: { to: { element: { types: { anyOf: ['mocks', 'api'] } } } },
  },
  // Addons are built and deployed separately: their own files plus the published packages only.
  {
    from: { element: { type: 'addon' } },
    allow: {
      to: { element: { type: 'addon', captured: { addon: '{{ from.element.captured.addon }}' } } },
    },
  },
  // `api` for types only, see addonImportRestrictions.
  {
    from: { element: { type: 'addon' } },
    allow: { to: { element: { types: { anyOf: ['sdk', 'ui', 'api'] } } } },
  },
  {
    from: { element: { type: 'tool' } },
    allow: {
      to: { element: { type: 'tool', captured: { tool: '{{ from.element.captured.tool }}' } } },
    },
  },
  // tools/mock-system-manager serves the @oakestra/mocks handlers over HTTP.
  { from: { element: { type: 'tool' } }, allow: { to: { element: { type: 'mocks' } } } },
  { from: { element: { type: 'e2e' } }, allow: { to: { element: { type: 'e2e' } } } },
];

/** Workspace packages that addons may import by name. `@oakestra/api` only for types (M2). */
const addonImportRestrictions = {
  patterns: [
    {
      group: [
        '@oakestra/*',
        '!@oakestra/dashboard-sdk',
        '!@oakestra/dashboard-sdk/federation',
        '!@oakestra/ui',
        '!@oakestra/ui/chart',
        '!@oakestra/ui/data-table',
        '!@oakestra/ui/command',
        '!@oakestra/ui/map',
        '!@oakestra/ui/*.css',
        '!@oakestra/api',
      ],
      message:
        'Addons may only import @oakestra/dashboard-sdk, @oakestra/ui and (types of) @oakestra/api.',
    },
    {
      group: ['@oakestra/*/src', '@oakestra/*/src/**'],
      message: 'Import packages by their public entry points.',
    },
  ],
  paths: [
    {
      name: '@oakestra/api',
      allowTypeImports: true,
      message:
        'Addons get the API client from useOakestraApi(); import @oakestra/api for types only.',
    },
  ],
};

/**
 * Import boundary rules on their own, so they can be tested without type-aware linting.
 *
 * @param {{ rootDir: string }} options
 */
export function importBoundaries({ rootDir }) {
  return [
    {
      files: ['**/*.{ts,tsx,js,mjs}'],
      plugins: { boundaries },
      settings: {
        'boundaries/root-path': rootDir,
        'boundaries/elements': elements,
        'boundaries/include': ['apps/**', 'packages/**', 'addons/**', 'tools/**', 'e2e/**'],
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            noWarnOnMultipleProjects: true,
            project: [
              'apps/*/tsconfig.json',
              'packages/*/tsconfig.json',
              'addons/*/tsconfig.json',
              'tools/*/tsconfig.json',
              'e2e/tsconfig.json',
            ],
          },
        },
      },
      rules: {
        'boundaries/dependencies': ['error', { default: 'disallow', policies }],
      },
    },
    {
      // Matchers like expect.any() are typed `any` by design.
      files: ['**/*.test.{ts,tsx}'],
      rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
    },
    {
      files: ['addons/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': ['error', addonImportRestrictions],
      },
    },
    {
      // Mock data and the mock login (password = username) must never reach a production bundle.
      // Tests, the test helpers and the dev:mock entry are the only shell code allowed to use them.
      files: ['apps/shell/src/**/*.{ts,tsx}'],
      ignores: ['**/*.test.{ts,tsx}', 'apps/shell/src/test/**', 'apps/shell/src/mock-api.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@oakestra/*/src', '@oakestra/*/src/**'],
                message: 'Import packages by their public entry points.',
              },
              {
                group: ['@oakestra/mocks', '@oakestra/mocks/*'],
                message: '@oakestra/mocks is for tests and pnpm dev:mock only.',
              },
              {
                // src/test pulls in @oakestra/mocks, so it must stay out of production code too.
                group: ['**/test/*'],
                message: 'The test helpers in src/test are for tests only.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/ui/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@oakestra/dashboard-sdk',
                message: '@oakestra/ui sits below the SDK and must not depend on it.',
              },
            ],
          },
        ],
      },
    },
  ];
}

/**
 * @param {{ rootDir: string }} options rootDir is the repository root (where eslint.config.js lives)
 */
export function createConfig({ rootDir }) {
  return tseslint.config(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.vite/**',
        '**/.__mf__temp/**',
        'e2e/test-results/**',
        'e2e/playwright-report/**',
      ],
    },
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.js', 'packages/*/*.js', 'apps/*/scripts/*.mjs'],
          },
          tsconfigRootDir: rootDir,
        },
        globals: { ...globals.browser },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/no-explicit-any': 'error',
        // React Router loaders signal redirects and HTTP errors by throwing responses.
        '@typescript-eslint/only-throw-error': [
          'error',
          {
            allow: [
              { from: 'lib', name: 'Response' },
              { from: 'package', package: 'react-router', name: 'DataWithResponseInit' },
            ],
          },
        ],
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@oakestra/*/src', '@oakestra/*/src/**'],
                message: 'Import packages by their public entry points.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: { ...globals.node } },
    },
    {
      files: ['**/*.{ts,tsx}'],
      extends: [reactHooks.configs.flat['recommended-latest'], jsxA11y.flatConfigs.recommended],
    },
    {
      files: ['**/vite.config.ts', '**/vitest.config.ts', 'tools/**', 'e2e/**', '**/scripts/**'],
      languageOptions: { globals: { ...globals.node } },
    },
    ...importBoundaries({ rootDir }),
  );
}
