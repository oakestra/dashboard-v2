import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// vitest runs with apps/shell as the working directory.
const template = readFileSync(resolve(process.cwd(), 'docker/nginx.conf.template'), 'utf8');

/** Body of a top-level `location <selector> { ... }` inside the server block. */
function locationBody(selector: string): string {
  const start = template.indexOf(`location ${selector} {`);
  if (start < 0) throw new Error(`no location ${selector}`);
  const open = template.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < template.length; i += 1) {
    if (template[i] === '{') depth += 1;
    if (template[i] === '}') depth -= 1;
    if (depth === 0) return template.slice(open + 1, i);
  }
  throw new Error(`unterminated location ${selector}`);
}

// nginx stops inheriting add_header from the server block as soon as a location has its own, so
// every proxy location must carry the full set itself.
describe('nginx proxy locations that serve backend bodies', () => {
  it.each(['= /ui-addons', '/addons-api/', '/marketplace-api/'])(
    '%s sandboxes the response and disables sniffing',
    (selector) => {
      const body = locationBody(selector);
      expect(body).toContain(
        `add_header Content-Security-Policy "default-src 'none'; sandbox" always;`,
      );
      expect(body).toContain('add_header X-Content-Type-Options nosniff always;');
      expect(body).toContain('add_header Content-Disposition "attachment" always;');
      expect(body).toContain('add_header Cache-Control "no-store" always;');
    },
  );

  it('keeps the baseline directives on the shell entry point', () => {
    const body = locationBody('= /index.html');
    expect(body).toContain('frame-ancestors');
    expect(body).toContain('X-Content-Type-Options');
  });
});
