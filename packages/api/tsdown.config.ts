import { defineConfig } from 'tsdown';

// Builds the published package only. Inside the monorepo everything imports `src/` directly
// (package.json `exports`); `publishConfig` swaps in `dist/` when the package is packed.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  // One output file per source file, so `.ts` import specifiers become `.js` and the generated
  // `paths` types stay a separate declaration file instead of being inlined into every model.
  unbundle: true,
  // Declarations come from tsc with this package's tsconfig.json, which sets stableTypeOrdering.
  dts: true,
  fixedExtension: false,
  // Every runtime dependency stays an import; the build fails if anything from node_modules ends
  // up inlined.
  deps: { onlyBundle: [] },
  failOnWarn: true,
  // One line per emitted file would bury the rest of the root `pnpm build` output.
  report: false,
});
