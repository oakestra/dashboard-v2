import { defineConfig } from 'tsdown';

// Builds the published package only. Inside the monorepo everything imports `src/` directly
// (package.json `exports`); `publishConfig` swaps in `dist/` when the package is packed.
export default defineConfig({
  // The subpaths stay separate entries: each is its own lazily loaded shared module.
  entry: ['src/index.ts', 'src/chart.ts', 'src/data-table.ts', 'src/command.ts', 'src/map.ts'],
  format: 'esm',
  platform: 'neutral',
  // One output file per source file, so subpaths share component modules instead of each
  // carrying a copy, and `styles.css` can scan `dist/components` for class names.
  unbundle: true,
  // Declarations come from tsc with this package's tsconfig.json, which sets stableTypeOrdering.
  dts: true,
  fixedExtension: false,
  deps: { onlyBundle: [] },
  // Kept at `dist/styles/` so the relative `@source '../components'` in styles.css points at the
  // built components, just as it points at the sources in the monorepo.
  copy: [{ from: 'src/styles/*.css', to: 'dist/styles' }],
  checks: {
    // shadcn's 'use client' markers. Unbundled output keeps them at the top of each file anyway,
    // and nothing here is a React Server Components build.
    moduleLevelDirective: false,
  },
  failOnWarn: true,
  // One line per emitted file would bury the rest of the root `pnpm build` output.
  report: false,
});
