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
  // Shell-level tests of the linked addon packages (real router, layout, MSW backend).
  { type: 'shell-linked-test', pattern: 'apps/shell/src/linked' },
  { type: 'sdk', pattern: 'packages/dashboard-sdk' },
  { type: 'ui', pattern: 'packages/ui' },
  { type: 'api', pattern: 'packages/api' },
  { type: 'mocks', pattern: 'packages/mocks' },
  { type: 'addon', pattern: 'addons/*', capture: ['addon'] },
  // Addon packages linked into the shell: written against the SDK only, like addons/*.
  { type: 'module', pattern: 'modules/*', capture: ['module'] },
  { type: 'tool', pattern: 'tools/*', capture: ['tool'] },
  { type: 'e2e', pattern: 'e2e' },
];

const shellShared = ['sdk', 'ui', 'api'];

/** A policy letting `from` import every element of the given types. */
const allow = (from, ...types) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: types } } } },
});

const policies = [
  // `mocks` only for src/mock-api.ts (dev:mock); no-restricted-imports keeps it out of the rest.
  allow('shell-entry', 'shell-entry', 'shell-app', 'shell-core', 'mocks', ...shellShared),
  allow(
    'shell-app',
    'shell-app',
    'shell-core',
    'shell-shared',
    'shell-feature',
    'shell-test',
    // app/modules.ts links the addon packages into the shell.
    'module',
    ...shellShared,
  ),
  // Core is the platform features build on; it must not depend on any feature. `mocks` is for
  // tests only, enforced by no-restricted-imports below.
  allow('shell-core', 'shell-core', 'shell-test', 'mocks', ...shellShared),
  // The test helpers render the real app (providers, router, layouts) around what is tested.
  allow('shell-test', 'shell-core', 'shell-app', 'mocks', ...shellShared),
  allow(
    'shell-linked-test',
    'shell-linked-test',
    'shell-test',
    'shell-app',
    'shell-core',
    'module',
    'mocks',
    ...shellShared,
  ),
  // Shared components sit between core and features: they may use the platform, not features.
  allow('shell-shared', 'shell-shared', 'shell-core', ...shellShared),
  // Features may use core, shared components and their own files. Other features only through
  // their index.ts.
  allow('shell-feature', 'shell-core', 'shell-shared', 'shell-test', 'mocks', ...shellShared),
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
  allow('sdk', 'sdk', 'api'),
  allow('ui', 'ui'),
  allow('api', 'api'),
  allow('mocks', 'mocks', 'api'),
  // Addons are built and deployed separately: their own files plus the published packages only.
  {
    from: { element: { type: 'addon' } },
    allow: {
      to: { element: { type: 'addon', captured: { addon: '{{ from.element.captured.addon }}' } } },
    },
  },
  // `api` for types only, see addonImportRestrictions.
  allow('addon', 'sdk', 'ui', 'api'),
  // Module packages follow the addon rules, so any of them can later be built as a remote. They
  // never import each other: cross-package links go through URLs and useFeatureEnabled().
  {
    from: { element: { type: 'module' } },
    allow: {
      to: {
        element: { type: 'module', captured: { module: '{{ from.element.captured.module }}' } },
      },
    },
  },
  allow('module', 'sdk', 'ui', 'api'),
  {
    from: { element: { type: 'tool' } },
    allow: {
      to: { element: { type: 'tool', captured: { tool: '{{ from.element.captured.tool }}' } } },
    },
  },
  // The mock tools serve the @oakestra/mocks handlers over HTTP.
  allow('tool', 'mocks'),
  allow('e2e', 'e2e'),
];

const publicEntryPattern = {
  group: ['@oakestra/*/src', '@oakestra/*/src/**'],
  message: 'Import packages by their public entry points.',
};

const SDK_TESTING_ENTRY = '@oakestra/dashboard-sdk/testing';

/**
 * The SDK's Vite plugin runs in Node and pulls in Vite and Module Federation, so it belongs in the
 * build config only. Its own pattern, so the config files can drop it and keep the rest.
 */
const sdkVitePattern = {
  group: ['@oakestra/dashboard-sdk/vite', '@oakestra/dashboard-sdk/vite/*'],
  message: 'The SDK Vite plugin is for vite.config.ts and vitest.config.ts only.',
};

/** Workspace packages that addons may import by name. `@oakestra/api` only for types. */
const addonImportRestrictions = {
  patterns: [
    {
      group: [
        '@oakestra/*',
        '!@oakestra/dashboard-sdk',
        '!@oakestra/dashboard-sdk/federation',
        // Re-excluded explicitly: the negation above of the package would otherwise let it through.
        SDK_TESTING_ENTRY,
        '!@oakestra/ui',
        '!@oakestra/ui/chart',
        '!@oakestra/ui/data-table',
        '!@oakestra/ui/command',
        '!@oakestra/ui/map',
        '!@oakestra/ui/location-map',
        '!@oakestra/ui/flow',
        '!@oakestra/ui/*.css',
        '!@oakestra/api',
      ],
      message:
        'Addons may only import @oakestra/dashboard-sdk, @oakestra/ui and (types of) @oakestra/api.',
    },
    publicEntryPattern,
    sdkVitePattern,
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
 * Test files may additionally use the SDK's test helpers. They pull in @testing-library/react,
 * so they must stay out of the code that ships in the addon bundle.
 */
const addonTestImportRestrictions = {
  ...addonImportRestrictions,
  patterns: [
    {
      ...addonImportRestrictions.patterns[0],
      group: addonImportRestrictions.patterns[0].group.map((entry) =>
        entry === SDK_TESTING_ENTRY ? `!${SDK_TESTING_ENTRY}` : entry,
      ),
    },
    ...addonImportRestrictions.patterns.slice(1),
  ],
};

const addonConfigImportRestrictions = {
  ...addonImportRestrictions,
  patterns: addonImportRestrictions.patterns.filter((pattern) => pattern !== sdkVitePattern),
};

/**
 * Module packages (modules/*) get the addon rules minus what only a remote build has: no
 * stylesheet (the shell's Tailwind scans them, without a prefix), no federation config and no
 * `virtual:oakestra-addon`, which only the SDK's Vite plugin provides.
 */
const moduleOnlyPatterns = [
  {
    group: ['@oakestra/ui/*.css', '@oakestra/dashboard-sdk/federation', 'virtual:oakestra-addon'],
    message:
      'Linked module packages have no stylesheet, federation config or virtual:oakestra-addon; write the addon id as a literal.',
  },
];
// Unlike remote addons, linked packages may use @oakestra/api at runtime (schemas,
// parseClusterLocation): it is stateless, so the copy a later remote build would bundle is
// harmless. The API client itself still comes from useOakestraApi(), so the factories stay banned.
const moduleApiPaths = [
  {
    name: '@oakestra/api',
    importNames: [
      'createOakestraApi',
      'createOakestraClient',
      'createAddonsClient',
      'createAddonsManagerApi',
      'createMarketplaceApi',
    ],
    allowTypeImports: true,
    message: 'Linked packages get the API client from useOakestraApi(), never build their own.',
  },
];
const moduleImportRestrictions = {
  ...addonImportRestrictions,
  patterns: [...addonImportRestrictions.patterns, ...moduleOnlyPatterns],
  paths: moduleApiPaths,
};
const moduleTestImportRestrictions = {
  ...addonTestImportRestrictions,
  patterns: [...addonTestImportRestrictions.patterns, ...moduleOnlyPatterns],
  paths: moduleApiPaths,
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
        'boundaries/include': [
          'apps/**',
          'packages/**',
          'addons/**',
          'modules/**',
          'tools/**',
          'e2e/**',
        ],
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            noWarnOnMultipleProjects: true,
            project: [
              'apps/*/tsconfig.json',
              'packages/*/tsconfig.json',
              'addons/*/tsconfig.json',
              'modules/*/tsconfig.json',
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
      files: ['addons/**/*.test.{ts,tsx}'],
      rules: { '@typescript-eslint/no-restricted-imports': ['error', addonTestImportRestrictions] },
    },
    {
      files: ['modules/*/src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': ['error', moduleImportRestrictions],
      },
    },
    {
      files: ['modules/*/src/**/*.test.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-restricted-imports': ['error', moduleTestImportRestrictions],
      },
    },
    {
      files: ['addons/*/vite.config.ts', 'addons/*/vitest.config.ts'],
      rules: {
        '@typescript-eslint/no-restricted-imports': ['error', addonConfigImportRestrictions],
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
              publicEntryPattern,
              {
                group: ['@oakestra/dashboard-sdk/testing'],
                message: 'The SDK test helpers are for tests only.',
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
        '**/storybook-static/**',
        '**/coverage/**',
        '**/.vite/**',
        '**/.__mf__temp/**',
        'e2e/test-results/**',
        'e2e/playwright-report/**',
        // Placeholders (`port: __PORT__`) make it unparsable and outside every tsconfig; the pack
        // check generates an addon from it and runs typecheck, tests and build on that.
        'tools/create-addon/template/**',
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
            patterns: [publicEntryPattern],
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
