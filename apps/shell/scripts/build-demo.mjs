// Builds the static demo into dist-demo/: the shell in mode "demo" (MSW answers every backend
// call in the browser) plus production builds of the showcase addons, served where the shell
// expects remotes (addon-assets/<name>/). The output is plain files for GitHub Pages; the base path
// comes from DEMO_BASE (default /dashboard-v2/).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const shell = new URL('..', import.meta.url).pathname;
const root = join(shell, '../..');
const out = join(shell, 'dist-demo');

/** Addon name (definition id, /ui-addons name) -> package directory. */
const ADDONS = {
  example: 'addons/example',
  carbon: 'addons/demo-carbon',
  flops: 'addons/demo-flops',
};

const run = (args, cwd) => execFileSync('pnpm', args, { cwd, stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
run(['exec', 'vite', 'build', '--mode', 'demo'], shell);

for (const [name, dir] of Object.entries(ADDONS)) {
  run(['run', 'build'], join(root, dir));
  cpSync(join(root, dir, 'dist'), join(out, 'addon-assets', name), { recursive: true });
}

// public/config.json points at a local system-manager; the demo's API only exists inside MSW.
cpSync(join(shell, 'demo/config.json'), join(out, 'config.json'));
// GitHub Pages has no SPA fallback: unknown paths get 404.html, which then boots the app, and the
// router reads the real path from the address bar.
cpSync(join(out, 'index.html'), join(out, '404.html'));
// Without it Pages runs Jekyll, which skips files and folders starting with an underscore.
writeFileSync(join(out, '.nojekyll'), '');

const expected = [
  'mockServiceWorker.js',
  ...Object.keys(ADDONS).map((name) => `addon-assets/${name}/mf-manifest.json`),
];
const missing = expected.filter((file) => !existsSync(join(out, file)));
if (missing.length > 0) {
  console.error(`build-demo: missing in dist-demo/: ${missing.join(', ')}`);
  process.exit(1);
}
const html = readFileSync(join(out, 'index.html'), 'utf8');
console.log(`build-demo: dist-demo/ is ready (${/src="([^"]+)"/.exec(html)?.[1] ?? 'no entry'})`);
