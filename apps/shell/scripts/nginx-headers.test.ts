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

const SANDBOX_HEADERS = [
  `add_header Content-Security-Policy "default-src 'none'; sandbox" always;`,
  'add_header X-Content-Type-Options nosniff always;',
  'add_header Content-Disposition "attachment" always;',
];

// nginx stops inheriting add_header from the server block as soon as a location has its own, so
// every proxy location must carry the full set itself.
describe('nginx proxy locations that serve backend bodies', () => {
  it.each(['= /ui-addons', '/addons-api/', '/marketplace-api/'])(
    '%s sandboxes the response and disables sniffing',
    (selector) => {
      const body = locationBody(selector);
      for (const header of SANDBOX_HEADERS) expect(body).toContain(header);
      expect(body).toContain('add_header Cache-Control "no-store" always;');
    },
  );

  it('sandboxes the addon backends behind /addon-assets/<name>/api/', () => {
    const body = locationBody('~ ^/addon-assets/([a-z0-9-]+)/(api/.*)$');
    for (const header of SANDBOX_HEADERS) expect(body).toContain(header);
    // Above nginx's 1m default, so the addon's container sets the effective limit.
    expect(body).toContain('client_max_body_size 32m;');
    expect(template.indexOf('(api/.*)$ {')).toBeLessThan(
      template.indexOf('location ~ ^/addon-assets/([a-z0-9-]+)/(.*)$ {'),
    );
  });

  it('keeps the baseline directives on the shell entry point', () => {
    const body = locationBody('= /index.html');
    expect(body).toContain('frame-ancestors');
    expect(body).toContain('X-Content-Type-Options');
  });

  it.each([
    ['= /preset.json', 'no-cache'],
    ['~ ^/bundled-addons/.+/(mf-manifest\\.json|remoteEntry\\.js)$', 'no-cache'],
    ['~ ^/bundled-addons/[a-z0-9-]+/assets/', 'public, max-age=31536000, immutable'],
    ['/bundled-addons/', 'no-cache'],
  ])(
    'static location %s repeats the nosniff header and never falls back to the SPA',
    (selector, cache) => {
      const body = locationBody(selector);
      expect(body).toContain(`add_header Cache-Control "${cache}" always;`);
      expect(body).toContain('add_header X-Content-Type-Options nosniff always;');
      expect(body).toContain('try_files $uri =404;');
    },
  );

  it('revalidates everything bundled addons serve outside assets/, and refuses framing', () => {
    const body = locationBody('/bundled-addons/');
    expect(body).not.toContain('immutable');
    expect(body).toContain(`add_header Content-Security-Policy "frame-ancestors 'none'" always;`);
  });

  it('marks only content-hashed build output immutable', () => {
    const immutable = [...template.matchAll(/location ([^{]*)\{([^}]*)\}/g)]
      .filter(([, , body]) => String(body).includes('immutable'))
      .map(([, selector]) => String(selector).trim());
    expect(immutable).toEqual(['~ ^/bundled-addons/[a-z0-9-]+/assets/', '/assets/']);
  });
});
