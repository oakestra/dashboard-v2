// Fails the build if dev-only code made it into the production bundle. The addon override would
// let a crafted link load arbitrary code into a logged-in session, and the mock API (MSW plus
// fixtures, with a login that accepts the username as password) must never answer real users.
// Both have to be compiled out, not just switched off at runtime.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const forbidden = [
  'addon-override',
  'oakestra.addon-overrides',
  'mockServiceWorker',
  'mock-signature',
  '[mock api]',
];

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(js|mjs|html)$/.test(entry.name)) yield path;
  }
}

const offenders = [];
for (const file of files(dist)) {
  const content = readFileSync(file, 'utf8');
  for (const needle of forbidden) {
    if (content.includes(needle)) offenders.push(`${file}: contains "${needle}"`);
  }
}

if (offenders.length > 0) {
  console.error('Production bundle contains dev-only code:\n' + offenders.join('\n'));
  process.exit(1);
}
console.log('assert-prod-bundle: no dev-only code (addon override, mock API) in dist/');
