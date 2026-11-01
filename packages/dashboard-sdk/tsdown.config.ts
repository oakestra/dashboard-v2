import { defineConfig } from 'tsdown';

// Builds the published package only. Inside the monorepo everything imports `src/` directly
// (package.json `exports`); `publishConfig` swaps in `dist/` when the package is packed.
export default defineConfig({
  entry: ['src/index.ts', 'src/federation.ts', 'src/testing.tsx'],
  format: 'esm',
  // `federation` runs in Node (addons' vite.config.ts), the rest in the browser and in test runners.
  platform: 'neutral',
  // One output file per source file. `testing` and the root entry must import the very same
  // `context.js`, otherwise the test providers and the hooks hold different React contexts.
  unbundle: true,
  // Declarations come from tsc with this package's tsconfig.json, which sets stableTypeOrdering.
  dts: true,
  fixedExtension: false,
  deps: { neverBundle: [/^node:/], onlyBundle: [] },
  failOnWarn: true,
  // One line per emitted file would bury the rest of the root `pnpm build` output.
  report: false,
});
